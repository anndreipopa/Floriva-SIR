#pragma once

#include "esp_err.h"

/**
 * Set up the pot-1 HX711 + load cell and start the weighing task.
 *
 * The task runs on its own and never returns:
 *  - first boot (no calibration in NVS): warm up -> tare (scale empty) -> asks for the
 *    reference item -> calibrates -> saves to NVS;
 *  - later boots: loads the calibration, warms up, does NOT tare again;
 *  - then weighs every WEIGHT_PERIOD_S seconds and logs the result.
 *
 * Settings live in app_config.h. Explanation: docs/firmware/load-cell.md
 *
 * @return ESP_OK, or an error if the HX711/load cell could not be set up or the task
 *         could not be created
 */
esp_err_t weight_task_start(void);
