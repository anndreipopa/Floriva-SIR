#pragma once

#include "esp_err.h"
#include <stdbool.h>

esp_err_t app_mqtt_init(void);
esp_err_t app_mqtt_publish_sensor_data(float temperature_c, float humidity_pct, float lux);
bool app_mqtt_is_connected(void);