#ifndef LOAD_CELL_H
#define LOAD_CELL_H

#include <stdbool.h>
#include <stdint.h>
#include "esp_err.h"
#include "hx711.h"

/**
 * ===== Load cell (layer 2: from raw counts to grams) =====
 *
 * Wraps one HX711 and adds:
 *  - noise filtering (burst of samples -> sort -> trimmed mean),
 *  - a stability check (spread of the kept samples),
 *  - tare (offset) and calibration with a known mass (counts per gram),
 *  - saving/loading that calibration in NVS so it survives reboots and re-flashing.
 *
 * Usual order on first use:  init -> tare -> wait_for_load -> calibrate -> save_calibration
 * Usual order afterwards:    init -> load_calibration -> read (periodically)
 *
 * Not thread-safe: use each instance from one task only.
 * Full explanation: docs/firmware/load-cell.md
 */

/** Opaque handle for one load cell. */
typedef struct load_cell_t *load_cell_handle_t;

typedef struct {
    hx711_handle_t hx711; /* already initialised by the app; the app keeps ownership */
    const char *nvs_key;  /* unique per cell, at most 15 characters, e.g. "pot1" */
} load_cell_config_t;

/** The two numbers that turn raw counts into grams: grams = (raw - offset) / counts_per_gram */
typedef struct {
    int32_t offset_raw;    /* filtered raw value with nothing (extra) on the cell = 0 g */
    float counts_per_gram; /* may be negative if the A+/A- wires are swapped; that is fine */
} load_cell_calibration_t;

/** One filtered measurement. */
typedef struct {
    int32_t grams;      /* rounded to whole grams */
    int32_t raw;        /* filtered raw value (trimmed mean) */
    int32_t spread_raw; /* max - min of the samples kept by the filter: a noise indicator */
    bool stable;        /* false if the spread stayed above the limit after all retries */
} load_cell_reading_t;

/**
 * Create a load cell on top of an initialised HX711. Does not touch NVS or the chip.
 *
 * @return ESP_OK, ESP_ERR_INVALID_ARG (NULL or nvs_key too long/empty), ESP_ERR_NO_MEM
 */
esp_err_t load_cell_init(const load_cell_config_t *config, load_cell_handle_t *out_handle);

/**
 * Load a calibration saved earlier with load_cell_save_calibration().
 *
 * @return ESP_OK            calibration loaded, load_cell_read() can be used
 *         ESP_ERR_NOT_FOUND nothing usable saved (first boot, or an old/invalid format)
 *         other             NVS error
 */
esp_err_t load_cell_load_calibration(load_cell_handle_t handle);

/**
 * Save the current offset and scale to NVS (flash).
 *
 * @return ESP_OK, ESP_ERR_INVALID_STATE if not tared and calibrated yet, or an NVS error
 */
esp_err_t load_cell_save_calibration(load_cell_handle_t handle);

/**
 * Tare: whatever is on the cell right now becomes 0 g. Uses a long, stable burst.
 * Keeps an existing counts_per_gram. Does not save; call load_cell_save_calibration().
 *
 * @return ESP_OK, ESP_ERR_INVALID_STATE if the readings never became stable,
 *         or an HX711 error (timeout, saturated input)
 */
esp_err_t load_cell_tare(load_cell_handle_t handle);

/**
 * Block until the reading moves at least min_net_raw counts away from the tare offset
 * (in either direction), i.e. until something has been placed on the cell.
 * Used during calibration, before the scale factor is known.
 *
 * @return ESP_OK, ESP_ERR_TIMEOUT, ESP_ERR_INVALID_STATE if not tared, or an HX711 error
 */
esp_err_t load_cell_wait_for_load(load_cell_handle_t handle, int32_t min_net_raw,
                                  uint32_t timeout_ms);

/**
 * Calibrate with a known mass that is on the cell now: counts_per_gram = net_raw / mass.
 * Does not save; call load_cell_save_calibration().
 *
 * @param known_mass_g mass of the reference item in grams (> 0)
 * @return ESP_OK, ESP_ERR_INVALID_ARG, ESP_ERR_INVALID_STATE (not tared / unstable),
 *         ESP_ERR_INVALID_RESPONSE (almost no change: item missing or wiring problem)
 */
esp_err_t load_cell_calibrate(load_cell_handle_t handle, int32_t known_mass_g);

/**
 * Take one filtered measurement and convert it to grams. Takes about 3 seconds
 * (more if it retries because the readings are unstable).
 *
 * An unstable reading is still returned (stable = false) so the caller can decide.
 *
 * @return ESP_OK, ESP_ERR_INVALID_STATE if not calibrated, or an HX711 error
 */
esp_err_t load_cell_read(load_cell_handle_t handle, load_cell_reading_t *out);

/**
 * Copy the current calibration (for logging or sending to the backend).
 *
 * @return ESP_OK, ESP_ERR_INVALID_STATE if not calibrated
 */
esp_err_t load_cell_get_calibration(load_cell_handle_t handle, load_cell_calibration_t *out);

/** Release the load cell. Does NOT deinit the HX711: the app owns it. */
esp_err_t load_cell_deinit(load_cell_handle_t handle);

#endif // LOAD_CELL_H
