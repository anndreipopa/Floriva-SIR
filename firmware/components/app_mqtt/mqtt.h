#pragma once

#include "esp_err.h"
#include <stdbool.h>
#include <stdint.h>

/** One weighing, as sent on the weight topic. */
typedef struct {
    int pot;             /* 1..3 */
    int32_t grams;       /* rounded to whole grams */
    int32_t raw;         /* filtered raw HX711 counts (for drift analysis) */
    int32_t spread_raw;  /* noise indicator of this reading */
    bool stable;         /* false if the reading never settled */
    uint32_t uptime_s;   /* seconds since boot: lets the backend spot restarts */
} app_mqtt_weight_t;

esp_err_t app_mqtt_init(void);
esp_err_t app_mqtt_publish_sensor_data(float temperature_c, float humidity_pct, float lux);

/**
 * Publish one weighing as JSON on MQTT_TOPIC_WEIGHT (QoS 1).
 * Safe to call from any task.
 *
 * @return ESP_OK, ESP_ERR_INVALID_ARG, ESP_ERR_INVALID_STATE if not connected (the reading
 *         is dropped, not queued), ESP_FAIL on an encoding or publish error
 */
esp_err_t app_mqtt_publish_weight(const app_mqtt_weight_t *weight);

bool app_mqtt_is_connected(void);