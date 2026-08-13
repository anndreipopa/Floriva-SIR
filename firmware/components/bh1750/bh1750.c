#include <stdio.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include "bh1750.h"
#include "driver/i2c_master.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"

/**
 * Tag for ESP_LOG macros - used to identify log messages from this driver
 */
static const char *TAG = "BH1750";

/**
 * Constant for timeout when performing I2C operations.
 * Using 1 second should be sufficient for most boards and conditions.
 */
#define BH1750_I2C_TIMEOUT_MS 1000U

/**
 * Internal instance structure for a BH1750 sensor.
 * This holds all state needed for a single sensor, allowing
 * multiple independent sensors in the same application.
 * 
 * Users see only the opaque handle pointer and don't need to
 * know about this internal structure.
 */
typedef struct bh1750_t {
    i2c_master_dev_handle_t i2c_dev;   /* Handle to the I2C device (from new I2C master API) */
    SemaphoreHandle_t mutex;        /* Mutex to protect concurrent access to sensor */
} bh1750_t;

/**
 * ===== BH1750 Light Sensor Driver (Multi-Device Architecture) =====
 * 
 * OWNERSHIP MODEL:
 * - Application creates and owns the I2C master bus
 * - Each sensor driver receives a bus handle and registers its device
 * - Each driver is responsible only for its own device registration
 * - Multiple sensors can share the same bus without conflict
 * 
 * THREAD SAFETY:
 * - The I2C master bus itself is thread-safe for multiple devices
 * - We keep a per-device mutex to protect the BH1750 measurement sequence
 *   (command, wait, read) from being interleaved if two threads access
 *   the same sensor instance concurrently.
 * - We do NOT add a global bus-level mutex—the I2C driver manages that
 */

/**
 * Initialize a BH1750 sensor on an existing I2C master bus.
 * 
 * This function:
 * 1. Validates input parameters
 * 2. Allocates memory for the sensor instance
 * 3. Registers the device on the provided I2C bus
 * 4. Powers on and resets the sensor
 * 5. Creates a mutex for thread-safe single-sensor access
 * 
 * The application must have created and configured the I2C master bus before calling.
 * 
 * @param config Pointer to configuration struct (bus handle + I2C address)
 * @param out_handle Pointer to store the sensor handle
 * 
 * @return ESP_OK on success, ESP_ERR_* otherwise
 */
esp_err_t bh1750_init(const bh1750_config_t *config, bh1750_handle_t *out_handle)
{
    /* Parameter validation - always check pointers first */
    if (config == NULL || out_handle == NULL) {
        ESP_LOGE(TAG, "Invalid parameters: config or out_handle is NULL");
        return ESP_ERR_INVALID_ARG;
    }

    /* Set handle to NULL early so failed initialization cannot leave a stale handle */
    *out_handle = NULL;

    /* Validate bus handle was provided */
    if (config->bus_handle == NULL) {
        ESP_LOGE(TAG, "Invalid bus handle: must provide an existing I2C master bus");
        return ESP_ERR_INVALID_ARG;
    }

    /* Validate I2C address is one of the two valid BH1750 addresses */
    if (config->i2c_address != BH1750_ADDR_LOW && config->i2c_address != BH1750_ADDR_HIGH) {
        ESP_LOGE(TAG, "Invalid I2C address: 0x%02X (must be 0x%02X or 0x%02X)",
                 config->i2c_address, BH1750_ADDR_LOW, BH1750_ADDR_HIGH);
        return ESP_ERR_INVALID_ARG;
    }

    /* Allocate memory for the sensor instance using calloc for zero-initialization */
    bh1750_t *sensor = (bh1750_t *)calloc(1, sizeof(bh1750_t));
    if (sensor == NULL) {
        ESP_LOGE(TAG, "Failed to allocate memory for sensor instance");
        return ESP_ERR_NO_MEM;
    }

    /* Create mutex for thread safety
     * Protects the multi-step measurement sequence within a single sensor instance
     */
    sensor->mutex = xSemaphoreCreateMutex();
    if (sensor->mutex == NULL) {
        ESP_LOGE(TAG, "Failed to create mutex");
        free(sensor);
        return ESP_ERR_NO_MEM;
    }

    /* Configure I2C device parameters */
    i2c_device_config_t dev_cfg = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,      /* 7-bit addressing */
        .device_address = config->i2c_address,      /* BH1750 slave address */
        .scl_speed_hz = 100000,                          /* Use bus default speed */
    };

    /* Register device on the provided I2C bus
     * This creates the device handle for all I2C operations on this sensor
     */
    esp_err_t ret = i2c_master_bus_add_device(config->bus_handle, &dev_cfg, &sensor->i2c_dev);

    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to add device to I2C bus: %s", esp_err_to_name(ret));
        vSemaphoreDelete(sensor->mutex);
        free(sensor);
        return ret;
    }

    /* Power on the sensor by sending POWER_ON command
     * This wakes up the sensor from standby mode
     */
    uint8_t cmd_power_on = BH1750_CMD_POWER_ON;
    ret = i2c_master_transmit(sensor->i2c_dev, &cmd_power_on, 1, BH1750_I2C_TIMEOUT_MS);
    
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to power on sensor: %s", esp_err_to_name(ret));
        i2c_master_bus_rm_device(sensor->i2c_dev);
        vSemaphoreDelete(sensor->mutex);
        free(sensor);
        return ret;
    }

    /* Small delay to let the sensor stabilize after power-on */
    vTaskDelay(pdMS_TO_TICKS(10));

    /* Reset internal state of sensor
     * Optional but good practice after power-on
     */
    uint8_t cmd_reset = BH1750_CMD_RESET;
    ret = i2c_master_transmit(sensor->i2c_dev, &cmd_reset, 1, BH1750_I2C_TIMEOUT_MS);
    
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "Failed to reset sensor (non-critical): %s", esp_err_to_name(ret));
        /* Don't fail initialization if reset fails, sensor can still work */
    }

    /* Return the opaque handle to the caller */
    *out_handle = (bh1750_handle_t)sensor;
    
    ESP_LOGI(TAG, "BH1750 initialized on shared I2C bus at address 0x%02X",
             config->i2c_address);
    
    return ESP_OK;
}

/**
 * Read illuminance (lux) value from the sensor.
 * 
 * This function:
 * 1. Validates the handle and output parameter
 * 2. Takes the mutex to ensure thread-safe access
 * 3. Sends the measurement command to the sensor
 * 4. Waits for measurement to complete (120ms for high-resolution mode)
 * 5. Reads 2 bytes of data
 * 6. Converts raw data to lux using sensor formula
 * 7. Returns the result via output parameter
 * 
 * Why use output parameter instead of return value?
 * - Return value is reserved for error codes (esp_err_t)
 * - This is a standard pattern in C APIs (POSIX style)
 * - Allows caller to distinguish between errors and invalid measurements
 * 
 * @param handle Sensor instance handle
 * @param lux_out Pointer to float where lux value will be written
 * 
 * @return ESP_OK on success, ESP_ERR_* otherwise
 */
esp_err_t bh1750_read_lux(bh1750_handle_t handle, float *lux_out)
{
    /* Parameter validation */
    if (handle == NULL || lux_out == NULL) {
        ESP_LOGE(TAG, "Invalid parameters: handle or lux_out is NULL");
        return ESP_ERR_INVALID_ARG;
    }

    bh1750_t *sensor = (bh1750_t *)handle;

    /* Acquire mutex with infinite timeout
     * This ensures only one thread accesses the sensor at a time
     */
    if (xSemaphoreTake(sensor->mutex, portMAX_DELAY) != pdTRUE) {
        ESP_LOGE(TAG, "Failed to acquire mutex");
        return ESP_ERR_INVALID_STATE;
    }

    /* Send measurement command (high resolution mode)
     * This command tells the sensor to measure light and enter standby
     */
    uint8_t cmd = BH1750_CMD_HIGH_RES_MODE;
    esp_err_t ret = i2c_master_transmit(sensor->i2c_dev, &cmd, 1, BH1750_I2C_TIMEOUT_MS);

    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to send measurement command: %s", esp_err_to_name(ret));
        xSemaphoreGive(sensor->mutex);
        return ret;
    }

    /* Wait for measurement to complete
     * High resolution mode requires 120ms measurement time per datasheet
     * pdMS_TO_TICKS() is the modern FreeRTOS way to convert ms to ticks
     * (Old way was ms / portTICK_PERIOD_MS - less portable)
     */
    vTaskDelay(pdMS_TO_TICKS(BH1750_MEASUREMENT_TIME_MS));

    /* Read 2 bytes of data from sensor
     * Sensor returns: [MSB][LSB] in big-endian format
     */
    uint8_t data[2];
    ret = i2c_master_receive(sensor->i2c_dev, data, 2, BH1750_I2C_TIMEOUT_MS);

    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to read data: %s", esp_err_to_name(ret));
        xSemaphoreGive(sensor->mutex);
        return ret;
    }

    /* Release mutex now that I2C operation is complete */
    xSemaphoreGive(sensor->mutex);

    /* Combine the two bytes into a 16-bit value (big-endian)
     * data[0] is high byte, data[1] is low byte
     */
    uint16_t raw_value = (data[0] << 8) | data[1];

    /* Convert raw sensor value to lux
     * Formula from BH1750 datasheet: lux = raw_value / 1.2
     * The 1.2 factor is specific to high-resolution mode
     */
    *lux_out = (float)raw_value / 1.2f;

    ESP_LOGD(TAG, "Raw: %u, Lux: %.1f", raw_value, *lux_out);

    return ESP_OK;
}

/**
 * Deinitialize and clean up a BH1750 sensor instance.
 * 
 * This function removes the device from the I2C bus and frees all resources
 * allocated by bh1750_init(). It does NOT delete the I2C master bus, which
 * remains under application control and may be shared by other sensors.
 * 
 * @param handle Sensor instance handle from bh1750_init()
 * 
 * @return ESP_OK on success
 *         ESP_ERR_INVALID_ARG if handle is NULL
 */
esp_err_t bh1750_deinit(bh1750_handle_t handle)
{
    if (handle == NULL) {
        ESP_LOGE(TAG, "Invalid handle: cannot deinitialize NULL sensor");
        return ESP_ERR_INVALID_ARG;
    }

    bh1750_t *sensor = (bh1750_t *)handle;

    /* Remove device from the I2C bus
     * This unregisters this device but leaves the bus intact for other devices
     */
    esp_err_t ret = i2c_master_bus_rm_device(sensor->i2c_dev);
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "Failed to remove device from bus: %s", esp_err_to_name(ret));
    }

    /* Delete mutex (synchronization object cleanup) */
    vSemaphoreDelete(sensor->mutex);

    /* Free allocated memory */
    free(sensor);

    ESP_LOGI(TAG, "BH1750 deinitialized");

    return ESP_OK;
}
