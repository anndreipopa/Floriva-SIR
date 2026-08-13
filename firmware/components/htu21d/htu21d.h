#ifndef HTU21D_H
#define HTU21D_H

#include <stdint.h>
#include <esp_err.h>
#include "driver/i2c_master.h"

/**

-----HTU21D Sensor for Relative Humidity and Temperature

*/

#define HTU21D_ADDR 0x40
#define HTU21D_CMD_SOFT_RESET 0xFE
#define HTU21D_CMD_TRIGGER_RH_NOHOLD 0xF5
#define HTU21D_CMD_TRIGGER_TEMP_NOHOLD 0xF3
#define HTU21D_CMD_READ_CONFIG 0xE7
#define HTU21D_CMD_WRITE_CONFIG 0xE6

typedef struct htu21d_t *htu21d_handle_t;

//Resolution enum config
typedef enum {
    HTU21D_RES_RH12_TEMP14 = 0x00,
    HTU21D_RES_RH8_TEMP12 = 0x01,
    HTU21D_RES_RH10_TEMP13 = 0x80,
    HTU21D_RES_RH11_TEMP11 = 0x81,
} htu21d_resolution_t;

typedef struct {
    i2c_master_bus_handle_t bus_handle;
    uint8_t i2c_address;
    htu21d_resolution_t resolution;
} htu21d_config_t;

// init sensor
esp_err_t htu21d_init(const htu21d_config_t *config, htu21d_handle_t *out_handle);

// read RH and temp in one call
esp_err_t htu21d_read(htu21d_handle_t handle, float *rh_out, float *temp_out);

//read rh and temp individually ( NOT IMPLEMENTED )
// esp_err_t htu21d_read_humidity(htu21d_handle_t handle, float *rh_out);
// esp_err_t htu21d_read_temperature(htu21d_handle_t handle, float *temp_out);

//cleanup
esp_err_t htu21d_deinit(htu21d_handle_t handle);