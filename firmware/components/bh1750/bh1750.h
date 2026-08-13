#ifndef BH1750_H
#define BH1750_H

#include <stdint.h>
#include "esp_err.h"
#include "driver/i2c_master.h"

/**
 * ===== BH1750 Light Sensor Driver =====
 * 
 * Modern ESP-IDF I2C implementation using the new master bus/device API.
 * This driver uses an instance-based design, allowing multiple sensors
 * on different I2C buses or addresses.
 */

/* Sensor I2C address - depends on ADDR pin: LOW=0x23, HIGH=0x5C */
#define BH1750_ADDR_LOW  0x23U

/* Sensor operation commands (from BH1750 datasheet) */
#define BH1750_CMD_POWER_ON        0x01U  /* Power on the sensor */
#define BH1750_CMD_RESET           0x07U  /* Reset internal state */
#define BH1750_CMD_HIGH_RES_MODE   0x10U  /* 1 lx resolution, 120ms measurement time */

/* Measurement time in milliseconds for high resolution mode */
#define BH1750_MEASUREMENT_TIME_MS 120

/**
 * Opaque handle for a BH1750 sensor instance.
 * Users don't need to know the internal structure.
 */
typedef struct bh1750_t *bh1750_handle_t;

/**
 * Supported BH1750 I2C addresses (depends on ADDR pin state).
 */
#define BH1750_ADDR_HIGH 0x5CU  /* Address when the ADDR pin is HIGH */

/**
 * Configuration struct for initializing a BH1750 sensor.
 * 
 * The application is responsible for creating and configuring the I2C master bus.
 * This driver only registers its device on the existing bus.
 */
typedef struct {
    i2c_master_bus_handle_t bus_handle;  /* Existing I2C master bus handle (app-owned) */
    uint8_t i2c_address;                 /* I2C slave address (0x23 or 0x5C) */
} bh1750_config_t;

/**
 * Initialize a BH1750 sensor instance on an existing I2C master bus.
 * 
 * The application must create and configure the I2C master bus before calling this.
 * This function registers the BH1750 as a device on that bus and initializes the sensor.
 * 
 * The BH1750 driver owns only the device registration. The application retains
 * ownership of the I2C master bus—the driver will not delete it on deinit.
 * 
 * @param config Pointer to configuration struct with bus handle and I2C address
 * @param out_handle Pointer to handle variable - will store the sensor instance
 *                   Set to NULL on any error
 * 
 * @return ESP_OK on success
 *         ESP_ERR_INVALID_ARG if config or out_handle is NULL, or address is invalid
 *         ESP_ERR_NO_MEM if memory allocation fails
 *         Other esp_err_t codes for I2C driver errors
 */
esp_err_t bh1750_init(const bh1750_config_t *config, bh1750_handle_t *out_handle);

/**
 * Perform a measurement and read lux value.
 * 
 * @param handle Sensor instance handle from bh1750_init()
 * @param lux_out Pointer to float where the lux value will be stored
 * 
 * @return ESP_OK on success and *lux_out contains valid lux value
 *         ESP_ERR_INVALID_ARG if parameters are invalid
 *         Other esp_err_t codes for I2C communication errors
 */
esp_err_t bh1750_read_lux(bh1750_handle_t handle, float *lux_out);

/**
 * Deinitialize a BH1750 sensor instance.
 * 
 * This function removes the device from the I2C bus and frees all sensor-owned resources.
 * It does NOT delete the I2C master bus—that remains owned by the application.
 * 
 * @param handle Sensor instance handle from bh1750_init()
 * 
 * @return ESP_OK on success
 *         ESP_ERR_INVALID_ARG if handle is NULL
 */
esp_err_t bh1750_deinit(bh1750_handle_t handle);

#endif // BH1750_H