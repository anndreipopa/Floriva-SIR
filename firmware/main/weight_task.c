#include "weight_task.h"

#include <inttypes.h>
#include <string.h>
#include "esp_check.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "hx711.h"
#include "load_cell.h"
#include "mqtt.h"
#include "app_config.h"

static const char *TAG = "weight";

/* The build stops here until you have weighed your reference item and set its mass. */
_Static_assert(WEIGHT_CAL_MASS_G > 0,
               "Set WEIGHT_CAL_MASS_G in app_config.h to the mass of your reference item");

/* 6 KB: the 64-sample buffer (256 B), qsort, logging, and now the status/weight JSON buffers
 * built on this task's stack during a session. 4 KB was enough before the session code. */
#define WEIGHT_TASK_STACK_BYTES 6144
/* Above app_main's loop (priority 1) so a weighing is not delayed by the sensor loop. The
 * timing-critical bit-banging is protected by a critical section anyway. */
#define WEIGHT_TASK_PRIORITY (tskIDLE_PRIORITY + 2)
/* How often the warm-up countdown prints "N s left". */
#define WEIGHT_COUNTDOWN_LOG_EVERY_S 30
/* Pause before retrying a calibration step that failed (e.g. unstable readings). */
#define WEIGHT_CAL_RETRY_DELAY_MS 10000
/* Status field "secondsLeft" is left out when this is passed. */
#define NO_SECONDS_LEFT (-1)

/* Error codes sent in the status "error" field (snake_case, part of the MQTT contract). */
#define ERR_TARE_FAILED "tare_failed"
#define ERR_POT_NOT_AVAILABLE "pot_not_available"

/* Commands from the MQTT task arrive here (see on_command). Only the weight task reads it. */
static QueueHandle_t s_cmd_queue = NULL;

/* Id of the last command handled. A QoS 1 repeat carries the same id and is ignored.
 * One id is enough: there is one session at a time, commands arrive in order, and a repeat
 * arrives right after its original. Only the weight task touches it. */
static char s_last_cmd_id[APP_MQTT_CMD_ID_MAX_LEN + 1] = "";

/* How a calibration session ended. */
typedef enum {
    SESSION_ENDED,   /* calibration_end, timeout or error: back to normal weighing */
    SESSION_RESTART, /* a new calibration_start arrived: run a fresh session */
} session_result_t;

/* Seconds since boot (tick counter / tick rate; wraps after ~497 days). */
static uint32_t uptime_s(void)
{
    return (uint32_t)(xTaskGetTickCount() / configTICK_RATE_HZ);
}

/* Sleep for 'seconds', printing how much is left now and then so the log shows we are alive. */
static void countdown(const char *what, uint32_t seconds)
{
    uint32_t left = seconds;
    while (left > 0) {
        ESP_LOGI(TAG, "%s: %" PRIu32 " s left", what, left);
        const uint32_t step = (left < WEIGHT_COUNTDOWN_LOG_EVERY_S) ? left
                                                                     : WEIGHT_COUNTDOWN_LOG_EVERY_S;
        vTaskDelay(pdMS_TO_TICKS(step * 1000));
        left -= step;
    }
}

/* First-boot procedure: tare with the scale empty, then calibrate with the reference item.
 * Each step is retried until it succeeds, because there is nothing useful to do without it. */
static esp_err_t run_calibration(load_cell_handle_t cell)
{
    ESP_LOGW(TAG, "================ CALIBRATION (pot 1) ================");
    ESP_LOGW(TAG, "Step 1/3: the scale must be EMPTY. Do not touch it.");
    countdown("Warm-up before tare", WEIGHT_WARMUP_S);

    while (load_cell_tare(cell) != ESP_OK) {
        ESP_LOGW(TAG, "Tare failed; retrying in %d s. Is the scale empty and still?",
                 WEIGHT_CAL_RETRY_DELAY_MS / 1000);
        vTaskDelay(pdMS_TO_TICKS(WEIGHT_CAL_RETRY_DELAY_MS));
    }

    ESP_LOGW(TAG, "Step 2/3: PLACE the %d g reference item on the scale now.", WEIGHT_CAL_MASS_G);
    while (true) {
        esp_err_t err = load_cell_wait_for_load(cell, WEIGHT_CAL_DETECT_MIN_RAW,
                                                WEIGHT_CAL_PROMPT_REPEAT_S * 1000);
        if (err == ESP_OK) {
            break;
        }
        if (err == ESP_ERR_TIMEOUT) {
            ESP_LOGW(TAG, "Still waiting: place the %d g reference item on the scale.",
                     WEIGHT_CAL_MASS_G);
        } else {
            ESP_LOGE(TAG, "Sensor problem while waiting (%s); retrying in %d s",
                     esp_err_to_name(err), WEIGHT_CAL_RETRY_DELAY_MS / 1000);
            vTaskDelay(pdMS_TO_TICKS(WEIGHT_CAL_RETRY_DELAY_MS));
        }
    }

    ESP_LOGW(TAG, "Item detected. Hands off: settling for %d s.", WEIGHT_CAL_SETTLE_S);
    vTaskDelay(pdMS_TO_TICKS(WEIGHT_CAL_SETTLE_S * 1000));

    ESP_LOGW(TAG, "Step 3/3: measuring the reference item...");
    while (load_cell_calibrate(cell, WEIGHT_CAL_MASS_G) != ESP_OK) {
        ESP_LOGW(TAG, "Calibration failed; retrying in %d s. Is the item resting still?",
                 WEIGHT_CAL_RETRY_DELAY_MS / 1000);
        vTaskDelay(pdMS_TO_TICKS(WEIGHT_CAL_RETRY_DELAY_MS));
    }

    ESP_RETURN_ON_ERROR(load_cell_save_calibration(cell), TAG, "could not save calibration");
    ESP_LOGW(TAG, "Calibration done and saved. Leave the item on the scale for the drift test.");
    ESP_LOGW(TAG, "=====================================================");
    return ESP_OK;
}

/* ===== Commands: MQTT task -> queue -> weight task ===== */

/* Runs in the MQTT library's task (registered with app_mqtt_set_cmd_handler). It copies the
 * command into the queue and returns at once: timeout 0, it never waits. The weighing
 * itself takes seconds and must happen in the weight task, never here. */
static void on_command(const app_mqtt_cmd_t *cmd)
{
    if (xQueueSend(s_cmd_queue, cmd, 0) != pdTRUE) {
        ESP_LOGW(TAG, "Command queue full; cmd %s dropped", cmd->id);
    }
}

/* True if this command was already handled (a QoS 1 repeat). Otherwise remembers its id. */
static bool is_repeat(const app_mqtt_cmd_t *cmd)
{
    if (strcmp(cmd->id, s_last_cmd_id) == 0) {
        ESP_LOGI(TAG, "Repeat of cmd %s ignored", cmd->id);
        return true;
    }
    /* Same array size on both sides and cmd->id is '\0'-terminated, so this fits. */
    memcpy(s_last_cmd_id, cmd->id, sizeof(s_last_cmd_id));
    return false;
}

/* Wait for the next NEW command until `deadline` (a tick count). Repeats are skipped
 * without extending the wait. Returns false when the deadline passes with no command. */
static bool wait_for_command(TickType_t deadline, app_mqtt_cmd_t *out)
{
    while (true) {
        /* Signed difference: still correct when the tick counter wraps around. */
        const int32_t remaining = (int32_t)(deadline - xTaskGetTickCount());
        const TickType_t wait = (remaining > 0) ? (TickType_t)remaining : 0;
        if (xQueueReceive(s_cmd_queue, out, wait) != pdTRUE) {
            return false;
        }
        if (!is_repeat(out)) {
            return true;
        }
    }
}

/* ===== Publishing helpers ===== */

static void publish_status(int pot, const char *session, app_mqtt_device_state_t state,
                           int seconds_left, const char *error)
{
    const app_mqtt_status_t status = {
        .pot = pot,
        .session = session,
        .state = state,
        .seconds_left = seconds_left,
        .error = error,
        .uptime_s = uptime_s(),
    };
    /* If MQTT is down the status is lost; the backend notices the silence and times out. */
    (void)app_mqtt_publish_status(&status);
}

/* One filtered reading (~3 s), logged and published. `session` is NULL for normal readings. */
static void weigh_and_publish(load_cell_handle_t cell, const char *session)
{
    load_cell_reading_t r;
    esp_err_t err = load_cell_read(cell, &r);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "pot1: reading failed (%s)", esp_err_to_name(err));
        return;
    }

    ESP_LOGI(TAG, "pot1: %" PRId32 " g  (raw %" PRId32 ", spread %" PRId32 " counts, %s)%s%s",
             r.grams, r.raw, r.spread_raw, r.stable ? "stable" : "UNSTABLE",
             session ? "  session " : "", session ? session : "");

    const app_mqtt_weight_t msg = {
        .pot = WEIGHT_POT1_NUMBER,
        .grams = r.grams,
        .raw = r.raw,
        .spread_raw = r.spread_raw,
        .stable = r.stable,
        .uptime_s = uptime_s(),
        .session = session,
    };
    /* If MQTT is down the reading is only logged locally; the next one will be sent. */
    (void)app_mqtt_publish_weight(&msg);
}

/* ===== Calibration session (design D3: warming_up -> taring -> streaming -> idle) ===== */

/* Any command during a session stops it: calibration_end ends it, a new calibration_start
 * replaces it (the backend is the authority on which session is current). */
static session_result_t on_session_command(const char *session, const app_mqtt_cmd_t *cmd,
                                           app_mqtt_cmd_t *next)
{
    if (cmd->type == APP_MQTT_CMD_CALIBRATION_START) {
        ESP_LOGW(TAG, "Session %s replaced by a new calibration_start (%s)", session, cmd->id);
        *next = *cmd;
        return SESSION_RESTART;
    }
    ESP_LOGI(TAG, "Session %s: calibration_end received", session);
    return SESSION_ENDED;
}

/*
 * Run one live calibration session for pot 1. Blocks this task until the session ends.
 *  1. warming_up: countdown so the user can lift the pot off (status every few seconds);
 *  2. taring:     the empty cell becomes 0 g; the new zero is saved to NVS, because the dry
 *                 and wet points are measured against it and must still match after a reboot;
 *  3. streaming:  a reading every WEIGHT_SESSION_STREAM_PERIOD_MS, tagged with the session id.
 * Ends on calibration_end, on the WEIGHT_SESSION_TIMEOUT_S safety timeout, or on an error.
 *
 * @return SESSION_RESTART with *next = the new start command, or SESSION_ENDED (idle sent)
 */
static session_result_t run_session(load_cell_handle_t cell, const app_mqtt_cmd_t *start,
                                    app_mqtt_cmd_t *next)
{
    const int pot = start->pot;
    const char *session = start->id; /* the start command's id is the session id */
    const TickType_t timeout_at =
        xTaskGetTickCount() + pdMS_TO_TICKS(WEIGHT_SESSION_TIMEOUT_S * 1000);
    session_result_t result = SESSION_ENDED;
    app_mqtt_cmd_t cmd;
    TickType_t next_reading = 0;
    esp_err_t err = ESP_OK;

    /* 1. warming_up */
    ESP_LOGW(TAG, "Session %s: lift the pot off the scale; tare in %d s", session,
             WEIGHT_SESSION_PREPARE_S);
    int left = WEIGHT_SESSION_PREPARE_S;
    while (left > 0) {
        publish_status(pot, session, APP_MQTT_STATE_WARMING_UP, left, NULL);
        const int step = (left < WEIGHT_SESSION_STATUS_EVERY_S) ? left
                                                                : WEIGHT_SESSION_STATUS_EVERY_S;
        if (wait_for_command(xTaskGetTickCount() + pdMS_TO_TICKS(step * 1000), &cmd)) {
            result = on_session_command(session, &cmd, next);
            goto done;
        }
        left -= step;
    }

    /* 2. taring */
    publish_status(pot, session, APP_MQTT_STATE_TARING, NO_SECONDS_LEFT, NULL);
    err = load_cell_tare(cell);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Session %s: tare failed (%s). Was the scale empty and still?", session,
                 esp_err_to_name(err));
        publish_status(pot, session, APP_MQTT_STATE_ERROR, NO_SECONDS_LEFT, ERR_TARE_FAILED);
        goto done; /* result is SESSION_ENDED */
    }
    err = load_cell_save_calibration(cell);
    if (err != ESP_OK) {
        /* The new zero still works until the next reboot; worth a warning, not an abort. */
        ESP_LOGW(TAG, "Session %s: new zero not saved to NVS (%s)", session, esp_err_to_name(err));
    }

    /* 3. streaming */
    ESP_LOGW(TAG, "Session %s: streaming. Place the pot when the dashboard says so.", session);
    publish_status(pot, session, APP_MQTT_STATE_STREAMING, NO_SECONDS_LEFT, NULL);
    next_reading = xTaskGetTickCount();
    while (true) {
        if ((int32_t)(xTaskGetTickCount() - timeout_at) >= 0) {
            ESP_LOGW(TAG, "Session %s: no calibration_end after %d min; ending it", session,
                     WEIGHT_SESSION_TIMEOUT_S / 60);
            goto done; /* result is SESSION_ENDED */
        }

        weigh_and_publish(cell, session);

        next_reading += pdMS_TO_TICKS(WEIGHT_SESSION_STREAM_PERIOD_MS);
        /* A reading that retried can take longer than the period: do not try to catch up. */
        if ((int32_t)(next_reading - xTaskGetTickCount()) < 0) {
            next_reading = xTaskGetTickCount();
        }
        if (wait_for_command(next_reading, &cmd)) {
            result = on_session_command(session, &cmd, next);
            goto done;
        }
    }

done:
    /* One exit: whatever stopped the session, the device reports idle (unless a new session
     * follows straight away, which reports warming_up itself). */
    if (result == SESSION_ENDED) {
        publish_status(pot, NULL, APP_MQTT_STATE_IDLE, NO_SECONDS_LEFT, NULL);
        ESP_LOGI(TAG, "Session %s finished; normal weighing every %d s", session,
                 WEIGHT_PERIOD_S);
    }
    return result;
}

/* A new command while idle. Returns true if a session ran (the caller restarts its schedule). */
static bool handle_idle_command(load_cell_handle_t cell, app_mqtt_cmd_t cmd)
{
    bool session_ran = false;
    while (true) {
        if (cmd.type == APP_MQTT_CMD_CALIBRATION_END) {
            /* Nothing to end. Still answer, because status doubles as the acknowledgement. */
            ESP_LOGI(TAG, "calibration_end while idle; nothing to do");
            publish_status(cmd.pot, NULL, APP_MQTT_STATE_IDLE, NO_SECONDS_LEFT, NULL);
            return session_ran;
        }
        if (cmd.pot != WEIGHT_POT1_NUMBER) {
            ESP_LOGW(TAG, "calibration_start for pot %d: only pot %d has a load cell", cmd.pot,
                     WEIGHT_POT1_NUMBER);
            publish_status(cmd.pot, cmd.id, APP_MQTT_STATE_ERROR, NO_SECONDS_LEFT,
                           ERR_POT_NOT_AVAILABLE);
            publish_status(cmd.pot, NULL, APP_MQTT_STATE_IDLE, NO_SECONDS_LEFT, NULL);
            return session_ran;
        }

        app_mqtt_cmd_t next;
        session_ran = true;
        if (run_session(cell, &cmd, &next) == SESSION_ENDED) {
            return session_ran;
        }
        cmd = next; /* SESSION_RESTART: run a fresh session for the new start command */
    }
}

/* ===== The task ===== */

static void weight_task(void *arg)
{
    load_cell_handle_t cell = arg;

    bool need_calibration = WEIGHT_FORCE_CALIBRATION;
    if (need_calibration) {
        ESP_LOGW(TAG, "WEIGHT_FORCE_CALIBRATION is 1: recalibrating (set it back to 0 after!)");
    } else {
        esp_err_t err = load_cell_load_calibration(cell);
        if (err == ESP_ERR_NOT_FOUND) {
            ESP_LOGW(TAG, "No saved calibration: first boot");
            need_calibration = true;
        } else if (err != ESP_OK) {
            ESP_LOGE(TAG, "Reading saved calibration failed (%s); recalibrating",
                     esp_err_to_name(err));
            need_calibration = true;
        }
    }

    if (need_calibration) {
        if (run_calibration(cell) != ESP_OK) {
            ESP_LOGE(TAG, "Calibration could not be saved; weighing task stops");
            vTaskDelete(NULL); /* a FreeRTOS task must never just return */
        }
    } else {
        load_cell_calibration_t cal;
        ESP_ERROR_CHECK(load_cell_get_calibration(cell, &cal));
        ESP_LOGI(TAG, "Using saved calibration: offset %" PRId32 " counts, %.2f counts/g "
                      "(no re-tare)",
                 cal.offset_raw, cal.counts_per_gram);
        countdown("Warm-up before first reading", WEIGHT_WARMUP_S);
    }

    /* Idle loop: sleep on the command queue until the next normal weighing is due. Waiting on
     * the queue (instead of vTaskDelay) means a command wakes the task at once, even in the
     * middle of a 2 h wait. Commands that arrived during the warm-up are waiting in the queue. */
    const TickType_t period = pdMS_TO_TICKS(WEIGHT_PERIOD_S * 1000);
    TickType_t next_weighing = xTaskGetTickCount(); /* first reading right after warm-up */
    while (true) {
        app_mqtt_cmd_t cmd;
        if (wait_for_command(next_weighing, &cmd)) {
            if (handle_idle_command(cell, cmd)) {
                /* The session's last stream reading is fresh: start a new normal period. */
                next_weighing = xTaskGetTickCount() + period;
            }
            continue;
        }

        weigh_and_publish(cell, NULL);
        /* Fixed rhythm: the ~3 s a reading takes is not added on top of the period. */
        next_weighing += period;
    }
}

esp_err_t weight_task_start(void)
{
    const hx711_config_t hx_cfg = {
        .dout_gpio = HX711_POT1_DOUT_GPIO,
        .sck_gpio = HX711_POT1_SCK_GPIO,
    };
    hx711_handle_t hx;
    ESP_RETURN_ON_ERROR(hx711_init(&hx_cfg, &hx), TAG, "HX711 init failed");

    const load_cell_config_t cell_cfg = {
        .hx711 = hx,
        .nvs_key = WEIGHT_POT1_NVS_KEY,
    };
    load_cell_handle_t cell;
    ESP_RETURN_ON_ERROR(load_cell_init(&cell_cfg, &cell), TAG, "load cell init failed");

    /* The queue must exist before the handler is registered: the first command could arrive
     * as soon as MQTT connects. Each item is a full copy of the command (~44 bytes). */
    s_cmd_queue = xQueueCreate(WEIGHT_CMD_QUEUE_LEN, sizeof(app_mqtt_cmd_t));
    ESP_RETURN_ON_FALSE(s_cmd_queue != NULL, ESP_ERR_NO_MEM, TAG, "could not create cmd queue");
    app_mqtt_set_cmd_handler(on_command);

    BaseType_t ok = xTaskCreate(weight_task, "weight", WEIGHT_TASK_STACK_BYTES, cell,
                                WEIGHT_TASK_PRIORITY, NULL);
    ESP_RETURN_ON_FALSE(ok == pdPASS, ESP_ERR_NO_MEM, TAG, "could not create weight task");
    return ESP_OK;
}
