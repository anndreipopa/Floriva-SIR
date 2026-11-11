#include "weight_task.h"

#include <inttypes.h>
#include "esp_check.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "hx711.h"
#include "load_cell.h"
#include "mqtt.h"
#include "app_config.h"

static const char *TAG = "weight";

/* The build stops here until you have weighed your reference item and set its mass. */
_Static_assert(WEIGHT_CAL_MASS_G > 0,
               "Set WEIGHT_CAL_MASS_G in app_config.h to the mass of your reference item");

/* 4 KB: room for the 64-sample buffer (256 B), logging, and qsort. */
#define WEIGHT_TASK_STACK_BYTES 4096
/* Above app_main's loop (priority 1) so a weighing is not delayed by the sensor loop. The
 * timing-critical bit-banging is protected by a critical section anyway. */
#define WEIGHT_TASK_PRIORITY (tskIDLE_PRIORITY + 2)
/* How often the warm-up countdown prints "N s left". */
#define WEIGHT_COUNTDOWN_LOG_EVERY_S 30
/* Pause before retrying a calibration step that failed (e.g. unstable readings). */
#define WEIGHT_CAL_RETRY_DELAY_MS 10000

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

    /* xTaskDelayUntil keeps a fixed rhythm: the ~3 s a reading takes is not added on top. */
    TickType_t last_wake = xTaskGetTickCount();
    while (true) {
        load_cell_reading_t r;
        esp_err_t err = load_cell_read(cell, &r);
        if (err == ESP_OK) {
            ESP_LOGI(TAG, "pot1: %" PRId32 " g  (raw %" PRId32 ", spread %" PRId32 " counts, %s)",
                     r.grams, r.raw, r.spread_raw, r.stable ? "stable" : "UNSTABLE");

            const app_mqtt_weight_t msg = {
                .pot = WEIGHT_POT1_NUMBER,
                .grams = r.grams,
                .raw = r.raw,
                .spread_raw = r.spread_raw,
                .stable = r.stable,
                /* Tick counter / tick rate = seconds since boot (wraps after ~497 days). */
                .uptime_s = (uint32_t)(xTaskGetTickCount() / configTICK_RATE_HZ),
            };
            /* If MQTT is down the reading is only logged locally; the next one will be sent. */
            (void)app_mqtt_publish_weight(&msg);
        } else {
            ESP_LOGE(TAG, "pot1: reading failed (%s)", esp_err_to_name(err));
        }

        xTaskDelayUntil(&last_wake, pdMS_TO_TICKS(WEIGHT_PERIOD_S * 1000));
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

    BaseType_t ok = xTaskCreate(weight_task, "weight", WEIGHT_TASK_STACK_BYTES, cell,
                                WEIGHT_TASK_PRIORITY, NULL);
    ESP_RETURN_ON_FALSE(ok == pdPASS, ESP_ERR_NO_MEM, TAG, "could not create weight task");
    return ESP_OK;
}
