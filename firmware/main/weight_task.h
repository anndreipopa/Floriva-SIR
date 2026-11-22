#pragma once

#include "esp_err.h"

/**
 * Set up the pot-1 HX711 + load cell, the command queue, and start the weighing task.
 *
 * The task runs on its own and never returns:
 *  - first boot (no calibration in NVS): warm up -> tare (scale empty) -> asks for the
 *    reference item -> calibrates -> saves to NVS;
 *  - later boots: loads the calibration, warms up, does NOT tare again;
 *  - then weighs every WEIGHT_PERIOD_S seconds (2 h) and publishes the result;
 *  - on a calibration_start command (MQTT cmd topic) it runs a live user-calibration session:
 *    warming_up -> taring -> streaming (a reading every ~4 s) -> idle, ended by
 *    calibration_end or after WEIGHT_SESSION_TIMEOUT_S. Progress goes out on the status topic.
 *
 * Call it BEFORE app_mqtt_init(): it registers the command handler.
 * Settings live in app_config.h. Explanations: docs/firmware/load-cell.md and
 * docs/pipeline/calibration-session.md
 *
 * @return ESP_OK, or an error if the HX711/load cell/queue could not be set up or the task
 *         could not be created
 */
esp_err_t weight_task_start(void);
