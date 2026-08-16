#include "mqtt.h"
#include "mqtt_client.h"
#include "esp_log.h"
#include "esp_crt_bundle.h"
#include "cJSON.h"
#include "../../config/mqtt_config.h"

static const char *TAG = "MQTT";
static esp_mqtt_client_handle_t s_client = NULL;
static volatile bool s_connected = false;

static void mqtt_event_handler(void *handler_args, esp_event_base_t base,
                                int32_t event_id, void *event_data)
{
    esp_mqtt_event_handle_t event = event_data;
    switch (event->event_id) {
        case MQTT_EVENT_CONNECTED:
            s_connected = true;
            ESP_LOGI(TAG, "Connected to MQTT broker");
            break;
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
    

esp_err_t app_mqtt_init(void)
{
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

bool app_mqtt_is_connected(void)
{
    return s_connected;
}

esp_err_t app_mqtt_publish_sensor_data(float temp, float rh, float lux)
{
    if (!s_connected) {
        ESP_LOGW(TAG, "Not connected, skipping publish");
        return ESP_ERR_INVALID_STATE;
    }

    char payload[128];
    int len = snprintf(payload, sizeof(payload),
        "{\"temperature\":%.1f,\"humidity\":%.0f,\"lux\":%.0f}",
        temp, rh, lux);

    if (len < 0 || len >= sizeof(payload)) {
        ESP_LOGE(TAG, "Payload buffer too small or encoding error");
        return ESP_FAIL;
    }

    int msg_id = esp_mqtt_client_publish(s_client, MQTT_TOPIC_SENSORS,
                                          payload, 0, /*qos=*/1, /*retain=*/0);
    ESP_LOGI(TAG, "Published msg_id=%d payload=%s", msg_id, payload);

    return (msg_id >= 0) ? ESP_OK : ESP_FAIL;
}