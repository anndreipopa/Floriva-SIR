#include "mqtt.h"
#include "mqtt_client.h"
#include "esp_log.h"
#include "esp_crt_bundle.h"
#include "cJSON.h"
#include "../../config/mqtt_config.h"
#include <inttypes.h>
#include <string.h>

/* Older copies of mqtt_config.h do not define the topics yet; fall back to the
 * documented default so the (secret, gitignored) file does not have to change. */
#ifndef MQTT_TOPIC_WEIGHT
#define MQTT_TOPIC_WEIGHT "floriva/floriva01/weight"
#endif

#ifndef MQTT_TOPIC_CMD
#define MQTT_TOPIC_CMD "floriva/floriva01/cmd"
#endif

#ifndef MQTT_TOPIC_STATUS
#define MQTT_TOPIC_STATUS "floriva/floriva01/status"
#endif

/* Room for "null" or a quoted id: 2 quotes + APP_MQTT_CMD_ID_MAX_LEN characters + '\0'. */
#define SESSION_JSON_MAX (APP_MQTT_CMD_ID_MAX_LEN + 3)

static const char *TAG = "MQTT";
static esp_mqtt_client_handle_t s_client = NULL;
static volatile bool s_connected = false;
/* Set once at start-up (before the MQTT client runs), read from the MQTT task. */
static volatile app_mqtt_cmd_handler_t s_cmd_handler = NULL;

/* Letters, digits, '-' and '_': safe to put inside a JSON string without escaping. */
static bool is_valid_id(const char *id) {
    for (const char *c = id; *c != '\0'; c++) {
        const bool ok = (*c >= 'a' && *c <= 'z') || (*c >= 'A' && *c <= 'Z') ||
                        (*c >= '0' && *c <= '9') || *c == '-' || *c == '_';
        if (!ok) {
            return false;
        }
    }
    return true;
}

/* Write a session id as a JSON value: "abc" or null. Ids were validated by is_valid_id(). */
static void format_session(char *out, size_t size, const char *session) {
    if (session == NULL || session[0] == '\0') {
        snprintf(out, size, "null");
    } else {
        snprintf(out, size, "\"%s\"", session);
    }
}

/* True if the event's topic (not '\0'-terminated) is exactly `topic`. */
static bool topic_is(const esp_mqtt_event_handle_t event, const char *topic) {
    const size_t len = strlen(topic);
    return event->topic_len == (int)len && strncmp(event->topic, topic, len) == 0;
}

/* Turn the text of a cmd message into a checked struct. Validation happens here, once, at the
 * edge: code that receives an app_mqtt_cmd_t can trust every field.
 * Returns ESP_OK and fills *out only if the whole command is valid; otherwise logs why,
 * leaves *out untouched and returns ESP_ERR_INVALID_ARG. */
static esp_err_t parse_command(const char *data, int len, app_mqtt_cmd_t *out) {
    esp_err_t ret = ESP_ERR_INVALID_ARG;
    const cJSON *id = NULL;
    const cJSON *type = NULL;
    const cJSON *pot = NULL;
    size_t id_len = 0;
    app_mqtt_cmd_type_t parsed_type;

    /* WithLength: the payload is not '\0'-terminated (same reason as %.*s in the log). */
    cJSON *root = cJSON_ParseWithLength(data, (size_t)len);
    if (root == NULL) {
        ESP_LOGW(TAG, "cmd ignored: not valid JSON");
        return ret; /* nothing allocated yet, so nothing to free */
    }

    id = cJSON_GetObjectItemCaseSensitive(root, "id");
    if (!cJSON_IsString(id) || id->valuestring == NULL) {
        ESP_LOGW(TAG, "cmd ignored: \"id\" missing or not a string");
        goto cleanup;
    }
    id_len = strlen(id->valuestring);
    if (id_len == 0 || id_len > APP_MQTT_CMD_ID_MAX_LEN) {
        ESP_LOGW(TAG, "cmd ignored: \"id\" must be 1..%d characters, got %u",
                 APP_MQTT_CMD_ID_MAX_LEN, (unsigned)id_len);
        goto cleanup;
    }
    if (!is_valid_id(id->valuestring)) {
        ESP_LOGW(TAG, "cmd ignored: \"id\" may only contain letters, digits, '-' and '_'");
        goto cleanup;
    }

    type = cJSON_GetObjectItemCaseSensitive(root, "type");
    if (!cJSON_IsString(type) || type->valuestring == NULL) {
        ESP_LOGW(TAG, "cmd ignored: \"type\" missing or not a string");
        goto cleanup;
    }
    if (strcmp(type->valuestring, "calibration_start") == 0) {
        parsed_type = APP_MQTT_CMD_CALIBRATION_START;
    } else if (strcmp(type->valuestring, "calibration_end") == 0) {
        parsed_type = APP_MQTT_CMD_CALIBRATION_END;
    } else {
        ESP_LOGW(TAG, "cmd ignored: unknown type \"%s\"", type->valuestring);
        goto cleanup;
    }

    pot = cJSON_GetObjectItemCaseSensitive(root, "pot");
    /* The second check rejects 1.5: valueint would silently turn it into 1. */
    if (!cJSON_IsNumber(pot) || pot->valuedouble != (double)pot->valueint) {
        ESP_LOGW(TAG, "cmd ignored: \"pot\" missing or not a whole number");
        goto cleanup;
    }
    if (pot->valueint < APP_MQTT_POT_MIN || pot->valueint > APP_MQTT_POT_MAX) {
        ESP_LOGW(TAG, "cmd ignored: pot %d is outside %d..%d", pot->valueint, APP_MQTT_POT_MIN,
                 APP_MQTT_POT_MAX);
        goto cleanup;
    }

    /* Everything checked: only now write the caller's struct. id_len + 1 copies the '\0' too,
     * and fits because id_len <= APP_MQTT_CMD_ID_MAX_LEN. */
    memcpy(out->id, id->valuestring, id_len + 1);
    out->type = parsed_type;
    out->pot = pot->valueint;
    ret = ESP_OK;

cleanup:
    /* One exit for every path after the parse, so the tree is always freed (no leak). */
    cJSON_Delete(root);
    return ret;
}

static void mqtt_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id,
                               void *event_data) {
    esp_mqtt_event_handle_t event = event_data;
    switch (event->event_id) {
    case MQTT_EVENT_CONNECTED: {
        s_connected = true;
        ESP_LOGI(TAG, "Connected to MQTT broker");

        // Subscribe on EVERY connect, with a clean session the broker forgets
        // our subscriptions when we disconnect.

        int sub_id = esp_mqtt_client_subscribe_single(event->client, MQTT_TOPIC_CMD, /*qos=*/1);

        if (sub_id < 0) {
            ESP_LOGE(TAG, "Subscribe to %s failed", MQTT_TOPIC_CMD);
        } else {
            ESP_LOGI(TAG, "Subscribing to %s (msg_id=%d)", MQTT_TOPIC_CMD, sub_id);
        }

        break;
    }

    case MQTT_EVENT_SUBSCRIBED:
        ESP_LOGI(TAG, "Subscribed to %s (msg_id = %d)", MQTT_TOPIC_CMD, event->msg_id);
        break;

    case MQTT_EVENT_DATA: {
        ESP_LOGI(TAG, "Received message on %.*s : %.*s", event->topic_len, event->topic,
                 event->data_len, event->data);

        /* A message bigger than the MQTT buffer arrives in pieces; a command never should. */
        if (event->data_len != event->total_data_len) {
            ESP_LOGW(TAG, "cmd ignored: too large (%d bytes)", event->total_data_len);
            break;
        }

        /* Only cmd is subscribed today, but a second topic (config) is planned. */
        if (!topic_is(event, MQTT_TOPIC_CMD)) {
            ESP_LOGW(TAG, "message on unexpected topic ignored");
            break;
        }

        app_mqtt_cmd_t cmd;
        if (parse_command(event->data, event->data_len, &cmd) == ESP_OK) {
            ESP_LOGI(TAG, "cmd ok: id=%s type=%d pot=%d", cmd.id, (int)cmd.type, cmd.pot);
            /* Copy the handler once: it is a shared variable, read it a single time. */
            const app_mqtt_cmd_handler_t handler = s_cmd_handler;
            if (handler != NULL) {
                handler(&cmd); /* must be quick: it only queues the command */
            } else {
                ESP_LOGW(TAG, "no command handler registered; cmd dropped");
            }
        }
        break;
    }

    case MQTT_EVENT_DISCONNECTED:
        s_connected = false;
        ESP_LOGW(TAG, "Disconnected from MQTT broker");
        break;
    case MQTT_EVENT_ERROR:
        ESP_LOGE(TAG, "MQTT error event");
        break;
    default:
        break;
    }
}

esp_err_t app_mqtt_init(void) {
    const esp_mqtt_client_config_t mqtt_cfg = {
        .broker.address.uri = MQTT_BROKER_URI,
        .broker.verification.crt_bundle_attach = esp_crt_bundle_attach,
        .credentials.username = MQTT_USERNAME,
        .credentials.authentication.password = MQTT_PASSWORD,
        .session.keepalive = 30,
    };

    s_client = esp_mqtt_client_init(&mqtt_cfg);
    if (!s_client) {
        ESP_LOGE(TAG, "Failed to init MQTT client");
        return ESP_FAIL;
    }

    esp_mqtt_client_register_event(s_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    return esp_mqtt_client_start(s_client);
}

bool app_mqtt_is_connected(void) {
    return s_connected;
}

void app_mqtt_set_cmd_handler(app_mqtt_cmd_handler_t handler) {
    s_cmd_handler = handler;
}

esp_err_t app_mqtt_publish_sensor_data(float temp, float rh, float lux) {
    if (!s_connected) {
        ESP_LOGW(TAG, "Not connected, skipping publish");
        return ESP_ERR_INVALID_STATE;
    }

    char payload[128];
    int len = snprintf(payload, sizeof(payload),
                       "{\"temperature\":%.1f,\"humidity\":%.0f,\"lux\":%.0f}", temp, rh, lux);

    if (len < 0 || len >= sizeof(payload)) {
        ESP_LOGE(TAG, "Payload buffer too small or encoding error");
        return ESP_FAIL;
    }

    int msg_id =
        esp_mqtt_client_publish(s_client, MQTT_TOPIC_SENSORS, payload, 0, /*qos=*/1, /*retain=*/0);
    ESP_LOGI(TAG, "Published msg_id=%d payload=%s", msg_id, payload);

    return (msg_id >= 0) ? ESP_OK : ESP_FAIL;
}

esp_err_t app_mqtt_publish_weight(const app_mqtt_weight_t *weight) {
    if (!weight) {
        return ESP_ERR_INVALID_ARG;
    }
    /* s_client is NULL until app_mqtt_init() runs; the weight task may start earlier. */
    if (!s_client || !s_connected) {
        ESP_LOGW(TAG, "Not connected, weight reading dropped");
        return ESP_ERR_INVALID_STATE;
    }

    /* esp_mqtt_client_publish() is thread-safe, so the weight task and the sensor loop in
     * app_main can both publish. */
    char session_json[SESSION_JSON_MAX];
    format_session(session_json, sizeof(session_json), weight->session);

    char payload[224];
    int len = snprintf(payload, sizeof(payload),
                       "{\"pot\":%d,\"grams\":%" PRId32 ",\"raw\":%" PRId32 ",\"spread\":%" PRId32
                       ",\"stable\":%s,\"uptimeS\":%" PRIu32 ",\"session\":%s}",
                       weight->pot, weight->grams, weight->raw, weight->spread_raw,
                       weight->stable ? "true" : "false", weight->uptime_s, session_json);

    if (len < 0 || len >= (int)sizeof(payload)) {
        ESP_LOGE(TAG, "Weight payload buffer too small or encoding error");
        return ESP_FAIL;
    }

    int msg_id =
        esp_mqtt_client_publish(s_client, MQTT_TOPIC_WEIGHT, payload, 0, /*qos=*/1, /*retain=*/0);
    ESP_LOGI(TAG, "Published weight msg_id=%d payload=%s", msg_id, payload);

    return (msg_id >= 0) ? ESP_OK : ESP_FAIL;
}

/* Text for the "state" field; must match the contract in docs/design/moisture-calibration.md. */
static const char *state_name(app_mqtt_device_state_t state) {
    switch (state) {
    case APP_MQTT_STATE_IDLE:
        return "idle";
    case APP_MQTT_STATE_WARMING_UP:
        return "warming_up";
    case APP_MQTT_STATE_TARING:
        return "taring";
    case APP_MQTT_STATE_STREAMING:
        return "streaming";
    case APP_MQTT_STATE_ERROR:
        return "error";
    }
    return "error"; /* unreachable with a valid enum; keeps the compiler happy */
}

esp_err_t app_mqtt_publish_status(const app_mqtt_status_t *status) {
    if (!status) {
        return ESP_ERR_INVALID_ARG;
    }
    if (!s_client || !s_connected) {
        ESP_LOGW(TAG, "Not connected, status dropped");
        return ESP_ERR_INVALID_STATE;
    }

    char session_json[SESSION_JSON_MAX];
    format_session(session_json, sizeof(session_json), status->session);

    /* Optional fields are built separately and left empty when they do not apply. The error
     * code comes from our own firmware constants (snake_case), so it needs no escaping. */
    /* 32: ',"secondsLeft":' is 15 characters + up to 11 for an int (with sign) + '\0'. */
    char seconds_left_json[32] = "";
    if (status->seconds_left >= 0) {
        snprintf(seconds_left_json, sizeof(seconds_left_json), ",\"secondsLeft\":%d",
                 status->seconds_left);
    }
    char error_json[48] = "";
    if (status->error != NULL) {
        snprintf(error_json, sizeof(error_json), ",\"error\":\"%s\"", status->error);
    }

    char payload[224];
    int len = snprintf(payload, sizeof(payload),
                       "{\"pot\":%d,\"session\":%s,\"state\":\"%s\"%s%s,\"uptimeS\":%" PRIu32 "}",
                       status->pot, session_json, state_name(status->state), seconds_left_json,
                       error_json, status->uptime_s);

    if (len < 0 || len >= (int)sizeof(payload)) {
        ESP_LOGE(TAG, "Status payload buffer too small or encoding error");
        return ESP_FAIL;
    }

    int msg_id =
        esp_mqtt_client_publish(s_client, MQTT_TOPIC_STATUS, payload, 0, /*qos=*/1, /*retain=*/0);
    ESP_LOGI(TAG, "Published status msg_id=%d payload=%s", msg_id, payload);

    return (msg_id >= 0) ? ESP_OK : ESP_FAIL;
}