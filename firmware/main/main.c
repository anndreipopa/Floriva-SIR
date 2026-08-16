#include "driver/i2c_master.h"
#include "bh1750.h"
#include "htu21d.h"
#include "mqtt.h"
#include "esp_log.h"
#include "esp_wifi.h"
#include "esp_netif.h"
#include "esp_event.h"
#include "nvs_flash.h"
#include "wifi.h"
#include "../config/wifi_config.h"

static const char *TAG = "MAIN APP";

void app_main(void){

    // Initialize NVS
     esp_err_t ret = nvs_flash_init();

    if (ret == ESP_ERR_NVS_NO_FREE_PAGES ||
        ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }

    ESP_ERROR_CHECK(ret);

    //create I2C master bus
    i2c_master_bus_config_t bus_cfg = {
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .i2c_port = I2C_NUM_0,
        .scl_io_num = 21,
        .sda_io_num = 22,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };

    i2c_master_bus_handle_t bus_handle;
    ESP_ERROR_CHECK(i2c_new_master_bus(&bus_cfg, &bus_handle));
    ESP_LOGI(TAG, "I2C Bus created");

    //initialize BH1750
    bh1750_config_t bh_cfg = {
        .bus_handle = bus_handle,
        .i2c_address = BH1750_ADDR_LOW,
    };
    bh1750_handle_t sensor_bh;
    ESP_ERROR_CHECK(bh1750_init(&bh_cfg, &sensor_bh));

    //Initialize HTU21D
    htu21d_config_t htu_cfg = {
        .bus_handle = bus_handle,
        .resolution = HTU21D_RES_RH12_TEMP14,
    };
    htu21d_handle_t sensor_htu;
    ESP_ERROR_CHECK(htu21d_init(&htu_cfg, &sensor_htu));

    //initialize WiFi
    ESP_ERROR_CHECK(wifi_init(WIFI_SSID, WIFI_PASS));

    //initialize MQTT connection
    ESP_ERROR_CHECK(app_mqtt_init());

    //Read loop
    while(1){
    float lux_sum = 0.0f;
    float rh_sum = 0.0f;
    float temp_sum = 0.0f;

    for(int i=0; i<3; i++){
        float lux;
        if(bh1750_read_lux(sensor_bh, &lux) == ESP_OK){
            lux_sum += lux;
        }

        float rh, temp;
        if(htu21d_read(sensor_htu, &rh, &temp) == ESP_OK){
            rh_sum += rh;
            temp_sum += temp;
        }

        vTaskDelay(pdMS_TO_TICKS(1000)); // time between reads, 2000 = 2 sec
    }

    //average the 3 readings for the truest value
    float lux_avg = lux_sum / 3.0f;
    float rh_avg = rh_sum / 3.0f;
    float temp_avg = (temp_sum / 3.0f) - 0.7f;

    ESP_LOGI(TAG, "LUX: %.1f", lux_avg);
    ESP_LOGI(TAG, "RH: %.1f%%, TEMP: %.2f°C", rh_avg, temp_avg);
    ESP_LOGI(TAG, "Read Complete");

    //publish payload to MQTT topic
    app_mqtt_publish_sensor_data(temp_avg, rh_avg, lux_avg);

    vTaskDelay(pdMS_TO_TICKS(177000));
    }
}