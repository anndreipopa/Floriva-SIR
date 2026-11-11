#ifndef HX711_H
#define HX711_H

#include <stdint.h>
#include "esp_err.h"
#include "driver/gpio.h"

/**
 * ===== HX711 24-bit load-cell ADC driver (layer 1: the chip) =====
 *
 * Talks to one HX711 over its two-wire serial interface (bit-banged GPIO).
 * Returns raw signed counts only. Filtering, tare and grams live in the
 * load_cell component on top of this one.
 *
 * Not thread-safe: use each instance from one task only.
 * Full explanation: docs/firmware/load-cell.md
 */

/**
 * Pins for one HX711. One of these per load cell.
 */
typedef struct {
    gpio_num_t dout_gpio; /* HX711 DOUT (Digital Out) -> ESP32 input; may be input-only (34-39) */
    gpio_num_t sck_gpio;  /* ESP32 output -> HX711 PD_SCK; must be an output-capable pin */
} hx711_config_t;

/**
 * Opaque handle for one HX711 instance. The struct behind it lives in hx711.c.
 */
typedef struct hx711_t *hx711_handle_t;

/**
 * Configure the two GPIOs and wake up the HX711 (SCK low).
 *
 * @param config      Pins to use (read only).
 * @param out_handle  Receives the new handle. Set to NULL on error.
 * @return ESP_OK on success
 *         ESP_ERR_INVALID_ARG if config or out_handle is NULL
 *         ESP_ERR_NO_MEM if memory allocation fails
 *         Other esp_err_t codes from GPIO configuration
 */
esp_err_t hx711_init(const hx711_config_t *config, hx711_handle_t *out_handle);

/**
 * Wait for a conversion and read one raw sample on channel A, gain 128.
 *
 * Blocks until the chip signals "ready" (up to ~100 ms at 10 samples/s).
 *
 * @param handle   Instance from hx711_init().
 * @param raw_out  Receives the signed 24-bit value (-8388608 .. 8388607).
 * @return ESP_OK on success
 *         ESP_ERR_INVALID_ARG if a parameter is NULL
 *         ESP_ERR_TIMEOUT if the HX711 never signalled ready (unpowered, unplugged, wrong pin)
 */
esp_err_t hx711_read_raw(hx711_handle_t handle, int32_t *raw_out);

/**
 * Power the HX711 down (SCK held high) and release the instance.
 *
 * @param handle  Instance from hx711_init().
 * @return ESP_OK, or ESP_ERR_INVALID_ARG if handle is NULL
 */
esp_err_t hx711_deinit(hx711_handle_t handle);

#endif // HX711_H
