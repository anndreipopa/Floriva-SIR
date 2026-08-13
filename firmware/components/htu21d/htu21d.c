#include <stdio.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include "htu21d.h"
#include "driver/i2c_master.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"

static const char *TAG = "HTU21D";

typedef struct htu21d_t {
    i2c_master_dev_handle_t i2c_dev;
    SemaphoreHandle_t mutex;
    htu21d_resolution_t resolution;
} htu21d_t;

//100110001

/**
    Calculate CRC-8 for HTU21D measurements.

    @param data pointer to 2-byte msrmnt [MSB, LSB]
    @return 8-bit CRC- value
*/

static uint8_t htu21d_crc8(const uint8_t *data, size_t len)
{
    uint8_t crc = 0x00;

    for(int i=0; i<len; i++){
        crc ^= data[i]; // XOR with the current byte

        for(int j=0; j<8; j++){
            if(crc & 0x80) { // check MSB
                crc = (crc << 1) ^ 0x31;
            } else {
                crc = crc << 1;
            }
            crc &= 0xFF;
        }
    }

    return crc;
}

/**
    Convert raw Relative Humidity reading to percentage
    Clamp practical user range to 0-100%
    @param raw_rh Raw 16-bit RH measurement from sensor
    @return RH percentage (0.0 to 100.0)
*/

static float htu21d_raw_to_rh(uint16_t raw_rh){
    // mask off the last 2 status bits
    raw_rh &= 0xFFFC;

    // apply datasheet formula of RH
    float rh = -6.0f + (125.0f * (float)raw_rh / 65536.0f);

    if(rh < 0.0f) rh = 0.0f;
    if(rh > 100.0f) rh = 100.0f;

    return rh;
}

/**
    Convert raw temp to Celsius
    Default resolution is 14 bit temp measurement
    
    @param raw_temp Raw 16-bit temp measurement from sensor
    @return Temp in Celsius
*/

static float htu21d_raw_to_temp(uint16_t raw_temp){
    //Mask off last 1 status bit
    raw_temp &= 0xFFFE;

    //apply datasheet formula:
    float temp = -46.85f + (175.72f * (float)raw_temp / 65536.0f);

    return temp;
}

/**
    Trigger measurement and read raw value with CRC validation
    Sends measurement command in NO_HOLD_MASTER mode and polls for completion
    @param sensor Pointer to sensor instance
    @param trigger_cmd Command to send
    @param raw_out Pointer to store raw 16bit result

    @return ESP_OK on success, ESP_ERR_* on failure
*/

static esp_err_t htu21d_trigger_and_read(
    htu21d_t *sensor,
    uint8_t trigger_cmd,
    uint16_t *raw_out
){

    esp_err_t ret;

    //Send trigger command to ESP
    ret = i2c_master_transmit(sensor -> i2c_dev, &trigger_cmd, 1, 1000);
    if (ret != ESP_OK){
        ESP_LOGE(TAG, "Failed to trigger measurement: %s", esp_err_to_name(ret));
        return ret;
    }

    //Step 2: wait for measurement to complete
    //Typical times: RH: 40ms, Temp: 50ms
    //Small delay before first poll attempt

    vTaskDelay(pdMS_TO_TICKS(50));

    //Read MSB, LSB, CRC

    uint8_t data[3];
    ret = i2c_master_receive(sensor -> i2c_dev, data, 3, 1000);
    if(ret != ESP_OK){
        ESP_LOGE(TAG, "Failed to read measurement: %s", esp_err_to_name(ret));
        return ret;
    }

    // Validate CRC from first 2 bytes only

    uint8_t expected_crc = htu21d_crc8(&data[0], 2);
    if (expected_crc != data[2]) {
        ESP_LOGE(TAG, "CRC mismatch: expected 0x%02X, got 0x%02X", expected_crc, data[2]);

        return ESP_ERR_INVALID_STATE;
    }

    // Combine MSB and LSB into one 16bit value

    *raw_out = (data[0] << 8) | data[1];

    ESP_LOGD(TAG, "Raw value: 0x%04X, CRC: 0x%02X", *raw_out, data[2]);

    return ESP_OK;

}

/**
    Initialize HTU21D sensor on existing I2C bus

    @param config pointer to config
    @param out_handle pointer to store sensor handle
    @return ESP_OK on success, ESP_ERR_* on failure
*/


esp_err_t htu21d_init(const htu21d_config_t *config, htu21d_handle_t *out_handle){
    //validate inputs
    if (config == NULL || out_handle == NULL){
        ESP_LOGE(TAG, "Invalid parameters");
        return ESP_ERR_INVALID_ARG;
    }

    //set handle to null early as failsafe
    *out_handle = NULL;

    //validate bus handle

    if(config -> bus_handle == NULL){
        ESP_LOGE(TAG, "Invalid bus handle");
        return ESP_ERR_INVALID_ARG;
    }

    //alocate sensor instance ( calloc for zero-init )
    htu21d_t *sensor = (htu21d_t *)calloc(1, sizeof(htu21d_t));
    if(sensor == NULL){
        ESP_LOGE(TAG, "Failed to allocate memory");
        return ESP_ERR_NO_MEM;
    }

    //store sensor res for later use

    sensor->resolution = config -> resolution;

    //create mutex for thread safety
    sensor -> mutex = xSemaphoreCreateMutex();
    if(sensor -> mutex == NULL){
        ESP_LOGE(TAG, "Failed to create mutex");
        free(sensor);
        return ESP_ERR_NO_MEM;
    }

    // configure i2c params
    i2c_device_config_t dev_cfg = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = HTU21D_ADDR,
        .scl_speed_hz = 100000,
    };

    //register device on i2c bus

    esp_err_t ret = i2c_master_bus_add_device(config -> bus_handle, &dev_cfg, &sensor -> i2c_dev);
    if(ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to add device to bus: %s", esp_err_to_name(ret));
        vSemaphoreDelete(sensor -> mutex);
        free(sensor);
        return ret;
    }

    //soft reset
    uint8_t cmd_reset = HTU21D_CMD_SOFT_RESET;
    ret = i2c_master_transmit(sensor -> i2c_dev, &cmd_reset, 1, 1000);
    if(ret != ESP_OK){
        ESP_LOGE(TAG, "Soft reset failed: %s", esp_err_to_name(ret));
        i2c_master_bus_rm_device(sensor -> i2c_dev);
        vSemaphoreDelete(sensor -> mutex);
        free(sensor);
        return ret;
    }

   // wait for sensor stabilisation
   vTaskDelay(pdMS_TO_TICKS(15));
   
   //write res config
   uint8_t cmd_config[] = {HTU21D_CMD_WRITE_CONFIG, (uint8_t)config -> resolution};
   ret = i2c_master_transmit(sensor -> i2c_dev, cmd_config, 2, 1000);
   if(ret != ESP_OK){
    ESP_LOGE(TAG, "Failed to write config(non critical): %s", esp_err_to_name(ret));
   }

   *out_handle = (htu21d_handle_t)sensor;
   
   ESP_LOGI(TAG, "HTU21D initialized on I2C bus at address 0x%02X", HTU21D_ADDR);
   
   return ESP_OK;
}

/**
    Read data from HTU21D sensor

    @param handle sensor instance handle
    @param rh_out pointer to store Relative Humidity %
    @param temp_out pointer to store temperature in Celsius

    @return ESP_OK on success, ESP_ERR_* on failure

*/

esp_err_t htu21d_read(const htu21d_handle_t handle, float *rh_out, float *temp_out){
    //validate params

    if(handle == NULL || rh_out == NULL || temp_out == NULL){
        ESP_LOGE(TAG, "Invalid parameters");
        return ESP_ERR_INVALID_ARG;
    }

    htu21d_t *sensor = (htu21d_t *)handle;

    //Take mutex to protect two-step measurement sequence
    if(xSemaphoreTake(sensor->mutex, portMAX_DELAY) != pdTRUE){
        ESP_LOGE(TAG, "Failed to acquire mutex");
        return ESP_ERR_INVALID_STATE;
    }

    esp_err_t ret;
    uint16_t raw_rh, raw_temp;

    //1: Trigger and read RH
    ret = htu21d_trigger_and_read(sensor, HTU21D_CMD_TRIGGER_RH_NOHOLD, &raw_rh);
    if(ret != ESP_OK){
        xSemaphoreGive(sensor -> mutex);
        return ret;
    }

    //2: Trigger and read TEMP
    ret = htu21d_trigger_and_read(sensor, HTU21D_CMD_TRIGGER_TEMP_NOHOLD, &raw_temp);
    if(ret != ESP_OK){
        xSemaphoreGive(sensor -> mutex);
        return ret;
    }

    //Release mutex cuz measurements complete
    xSemaphoreGive(sensor -> mutex);

    //3: Convert raw values to final results
    *rh_out = htu21d_raw_to_rh(raw_rh);
    *temp_out = htu21d_raw_to_temp(raw_temp);

    ESP_LOGI(TAG, "RH: %.1f%%, Temp: %.2f°C", *rh_out, *temp_out);

    return ESP_OK;
}

/**
    Deinitialize and cleanup a HTU21D sensor instance

    @param handle Sensor instance from htu21d_init()
    @return ESP_OK on success, ESP_ERR_* if failure
*/

esp_err_t htu21d_deinit(htu21d_handle_t handle){
    if(handle == NULL){
        ESP_LOGE(TAG, "Invalid handle: cannot deinitialize a NULL sensor");
        return ESP_ERR_INVALID_ARG;
    }

    htu21d_t *sensor = (htu21d_t *)handle;

    //Remove device from the I2C bus
    esp_err_t ret = i2c_master_bus_rm_device(sensor -> i2c_dev);
    if(ret != ESP_OK){
        ESP_LOGW(TAG, "Failed to remove device from bus: %s", esp_err_to_name(ret));
    }

    //delete mutex ( sync object cleanup)
    vSemaphoreDelete(sensor -> mutex);
    
    free(sensor);

    ESP_LOGI(TAG, "HTU21D deinitialized");
    return ESP_OK;
}