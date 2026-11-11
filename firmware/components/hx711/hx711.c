#include "hx711.h"

#include <stdlib.h>
#include "esp_check.h"
#include "esp_log.h"
#include "esp_rom_sys.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "hx711";

#define HX711_DATA_BITS 24
/* 25th pulse = channel A, gain 128 for the NEXT conversion (datasheet, PD_SCK pulse table). */
#define HX711_GAIN_A128_EXTRA_PULSES 1
/* Datasheet: PD_SCK high time 0.2..50 us. 1 us is safe and far below the 60 us power-down. */
#define HX711_CLOCK_HALF_PERIOD_US 1
/* At 10 SPS one conversion takes ~100 ms; wait twice that before calling the chip missing. */
#define HX711_READY_TIMEOUT_MS 200
/* Bit 23 is the sign bit of the 24-bit two's complement result. */
#define HX711_SIGN_BIT (1UL << 23)
/* Ones in bits 24..31. OR-ing them in turns a negative 24-bit value into a negative 32-bit one. */
#define HX711_SIGN_EXTEND_MASK 0xFF000000UL

struct hx711_t {
    gpio_num_t dout_gpio;
    gpio_num_t sck_gpio;
};

/* While this lock is held, interrupts on the current core are off, so WiFi cannot pause us
 * in the middle of an SCK-high pulse and stretch it past 60 us (which would power the chip
 * down and corrupt the reading). One lock is enough for all instances. */
static portMUX_TYPE s_hx711_lock = portMUX_INITIALIZER_UNLOCKED;

esp_err_t hx711_init(const hx711_config_t *config, hx711_handle_t *out_handle)
{
    ESP_RETURN_ON_FALSE(config && out_handle, ESP_ERR_INVALID_ARG, TAG, "null arg");
    *out_handle = NULL;

    gpio_config_t sck_cfg = {
        .pin_bit_mask = 1ULL << config->sck_gpio,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    ESP_RETURN_ON_ERROR(gpio_config(&sck_cfg), TAG, "SCK config failed");

    gpio_config_t dout_cfg = {
        .pin_bit_mask = 1ULL << config->dout_gpio,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE, /* the HX711 drives DOUT itself */
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    ESP_RETURN_ON_ERROR(gpio_config(&dout_cfg), TAG, "DOUT config failed");

    /* SCK low = chip awake. */
    ESP_RETURN_ON_ERROR(gpio_set_level(config->sck_gpio, 0), TAG, "SCK set failed");

    struct hx711_t *dev = calloc(1, sizeof(*dev));
    ESP_RETURN_ON_FALSE(dev, ESP_ERR_NO_MEM, TAG, "no memory");
    dev->dout_gpio = config->dout_gpio;
    dev->sck_gpio = config->sck_gpio;

    *out_handle = dev;
    ESP_LOGI(TAG, "init ok (DOUT=%d, SCK=%d)", dev->dout_gpio, dev->sck_gpio);
    return ESP_OK;
}

/* One clock pulse. Returns the DOUT level, read after the falling edge. */
static int hx711_pulse(const struct hx711_t *dev)
{
    gpio_set_level(dev->sck_gpio, 1);
    esp_rom_delay_us(HX711_CLOCK_HALF_PERIOD_US);
    gpio_set_level(dev->sck_gpio, 0);
    esp_rom_delay_us(HX711_CLOCK_HALF_PERIOD_US);
    return gpio_get_level(dev->dout_gpio);
}

/* DOUT goes low when a new conversion is ready. Poll it, yielding one tick each time so
 * other tasks can run, and give up after HX711_READY_TIMEOUT_MS. */
static esp_err_t hx711_wait_ready(const struct hx711_t *dev)
{
    const TickType_t start = xTaskGetTickCount();
    const TickType_t timeout = pdMS_TO_TICKS(HX711_READY_TIMEOUT_MS);

    while (gpio_get_level(dev->dout_gpio) != 0) {
        /* Unsigned subtraction stays correct even when the tick counter wraps around. */
        if ((xTaskGetTickCount() - start) >= timeout) {
            return ESP_ERR_TIMEOUT;
        }
        vTaskDelay(1); /* one tick, not pdMS_TO_TICKS(1): that is 0 ticks at 100 Hz */
    }
    return ESP_OK;
}

esp_err_t hx711_read_raw(hx711_handle_t handle, int32_t *raw_out)
{
    ESP_RETURN_ON_FALSE(handle && raw_out, ESP_ERR_INVALID_ARG, TAG, "null arg");

    esp_err_t err = hx711_wait_ready(handle);
    if (err != ESP_OK) {
        /* Debug level: the load_cell layer counts failures and logs one summary. */
        ESP_LOGD(TAG, "not ready after %d ms", HX711_READY_TIMEOUT_MS);
        return err;
    }

    /* Unsigned on purpose: shifting bits into a signed integer can be undefined behaviour. */
    uint32_t value = 0;

    portENTER_CRITICAL(&s_hx711_lock);
    for (int i = 0; i < HX711_DATA_BITS; i++) {
        /* Make room on the right, then drop the new bit in. MSB arrives first. */
        value = (value << 1) | (uint32_t)hx711_pulse(handle);
    }
    for (int i = 0; i < HX711_GAIN_A128_EXTRA_PULSES; i++) {
        (void)hx711_pulse(handle); /* selects channel/gain; DOUT is meaningless here */
    }
    portEXIT_CRITICAL(&s_hx711_lock);

    if (value & HX711_SIGN_BIT) {
        value |= HX711_SIGN_EXTEND_MASK;
    }

    /* GCC converts out-of-range unsigned to signed by keeping the bit pattern (two's
     * complement), so 0xFFFFFFFF becomes -1 here. */
    *raw_out = (int32_t)value;
    return ESP_OK;
}

esp_err_t hx711_deinit(hx711_handle_t handle)
{
    ESP_RETURN_ON_FALSE(handle, ESP_ERR_INVALID_ARG, TAG, "null handle");
    /* SCK held high for more than 60 us puts the HX711 into power-down mode. */
    gpio_set_level(handle->sck_gpio, 1);
    free(handle);
    return ESP_OK;
}
