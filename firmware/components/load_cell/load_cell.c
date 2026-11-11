#include "load_cell.h"

#include <inttypes.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>
#include "esp_check.h"
#include "esp_log.h"
#include "nvs.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "load_cell";

/* --- Filtering ---
 * Every measurement is a burst of samples: sort them, throw away the highest and lowest
 * quarter (spikes), average the middle half (smooths the remaining noise). */

/* Normal reading: 32 samples at 10 SPS is about 3.2 s. */
#define LOAD_CELL_READ_SAMPLES 32
/* Tare and calibration happen once and set the reference for months, so take twice as many. */
#define LOAD_CELL_CAL_SAMPLES 64
/* Short burst while waiting for the reference item, so placing it is noticed within ~1 s. */
#define LOAD_CELL_DETECT_SAMPLES 10
/* Size of the sample buffer: the largest burst above. */
#define LOAD_CELL_MAX_SAMPLES LOAD_CELL_CAL_SAMPLES
/* Drop 1/4 of the sorted samples at each end: keep the middle half. */
#define LOAD_CELL_TRIM_DIVISOR 4
/* A burst is rejected if more than 1/8 of its reads fail (timeout or saturated value). */
#define LOAD_CELL_MAX_BAD_DIVISOR 8

/* --- Stability ---
 * Spread = largest kept sample - smallest kept sample. A large spread means the load was
 * changing during the burst (touched, dripping, vibration) or the wiring is noisy.
 * STARTING VALUE, NOT MEASURED: about 10 g at the expected ~400 counts/g. Look at the
 * spread in the logs and tighten it once the real noise level is known. */
#define LOAD_CELL_MAX_SPREAD_RAW 4000
/* Bursts to try before a measurement is reported as unstable. */
#define LOAD_CELL_STABLE_ATTEMPTS 3
/* Pause between unstable bursts, to let a disturbance pass. */
#define LOAD_CELL_RETRY_DELAY_MS 2000
/* Pause between bursts while waiting for the reference item. */
#define LOAD_CELL_DETECT_POLL_MS 500

/* --- Calibration sanity ---
 * Below this many counts per gram the "reference item" changed almost nothing: it is not
 * on the cell, or a wire is loose. The expected value is in the hundreds. */
#define LOAD_CELL_MIN_COUNTS_PER_GRAM 10.0f

/* --- HX711 limits: the chip outputs these when the input is out of range (saturated). --- */
#define HX711_RAW_MAX 8388607    /*  2^23 - 1 */
#define HX711_RAW_MIN (-8388608) /* -2^23     */

/* --- NVS storage --- */
#define LOAD_CELL_NVS_NAMESPACE "load_cell"
/* NVS keys are limited to 15 characters. */
#define LOAD_CELL_NVS_KEY_MAX_LEN 15
/* Bump this if the blob layout changes; old blobs are then ignored instead of misread. */
#define LOAD_CELL_NVS_BLOB_VERSION 1

/* What is written to flash for one cell. */
typedef struct {
    uint32_t version;
    int32_t offset_raw;
    float counts_per_gram;
} load_cell_nvs_blob_t;

struct load_cell_t {
    hx711_handle_t hx711;
    char nvs_key[LOAD_CELL_NVS_KEY_MAX_LEN + 1];
    load_cell_calibration_t cal;
    bool tared;      /* cal.offset_raw is valid */
    bool calibrated; /* cal.counts_per_gram is valid */
};

/* qsort() needs a function that says which of two values comes first:
 * negative = a first, positive = b first, 0 = equal. Written without a - b, which could
 * overflow for large values. */
static int compare_int32(const void *a, const void *b)
{
    const int32_t x = *(const int32_t *)a;
    const int32_t y = *(const int32_t *)b;
    return (x > y) - (x < y);
}

/* Read n samples and reduce them to one number (trimmed mean) plus the spread of the
 * samples that were kept. Failed and saturated samples are skipped, up to a limit. */
static esp_err_t sample_burst(struct load_cell_t *dev, int n, int32_t *mean_out,
                              int32_t *spread_out)
{
    int32_t samples[LOAD_CELL_MAX_SAMPLES];
    const int max_bad = n / LOAD_CELL_MAX_BAD_DIVISOR;
    int good = 0;
    int bad = 0;

    while (good < n) {
        int32_t raw;
        esp_err_t err = hx711_read_raw(dev->hx711, &raw);

        if (err == ESP_OK && raw != HX711_RAW_MAX && raw != HX711_RAW_MIN) {
            samples[good++] = raw;
            continue;
        }

        bad++;
        if (bad > max_bad) {
            if (err != ESP_OK) {
                ESP_LOGE(TAG, "[%s] HX711 not responding (%s). Check power and DOUT/SCK wiring.",
                         dev->nvs_key, esp_err_to_name(err));
                return err;
            }
            ESP_LOGE(TAG, "[%s] HX711 input saturated (raw %" PRId32 "). Check the four "
                          "load cell wires (E+, E-, A+, A-).",
                     dev->nvs_key, raw);
            return ESP_ERR_INVALID_RESPONSE;
        }
    }

    qsort(samples, n, sizeof(samples[0]), compare_int32);

    const int trim = n / LOAD_CELL_TRIM_DIVISOR;
    const int kept = n - 2 * trim;
    int64_t sum = 0; /* 64-bit: 64 values near 8 million would overflow 32 bits */
    for (int i = trim; i < n - trim; i++) {
        sum += samples[i];
    }

    *mean_out = (int32_t)lround((double)sum / kept);
    *spread_out = samples[n - trim - 1] - samples[trim];
    return ESP_OK;
}

/* One measurement with the stability check: retry a few times if the spread is too big.
 * If require_stable is true, an unstable result is an error (used for tare/calibration).
 * Otherwise the last burst is returned with *stable_out = false (used for normal reads). */
static esp_err_t measure(struct load_cell_t *dev, int n, bool require_stable, int32_t *mean_out,
                         int32_t *spread_out, bool *stable_out)
{
    for (int attempt = 1; attempt <= LOAD_CELL_STABLE_ATTEMPTS; attempt++) {
        ESP_RETURN_ON_ERROR(sample_burst(dev, n, mean_out, spread_out), TAG,
                            "[%s] sampling failed", dev->nvs_key);

        if (*spread_out <= LOAD_CELL_MAX_SPREAD_RAW) {
            *stable_out = true;
            return ESP_OK;
        }

        ESP_LOGW(TAG, "[%s] unstable: spread %" PRId32 " counts (limit %d), attempt %d/%d",
                 dev->nvs_key, *spread_out, LOAD_CELL_MAX_SPREAD_RAW, attempt,
                 LOAD_CELL_STABLE_ATTEMPTS);
        if (attempt < LOAD_CELL_STABLE_ATTEMPTS) {
            vTaskDelay(pdMS_TO_TICKS(LOAD_CELL_RETRY_DELAY_MS));
        }
    }

    *stable_out = false;
    return require_stable ? ESP_ERR_INVALID_STATE : ESP_OK;
}

esp_err_t load_cell_init(const load_cell_config_t *config, load_cell_handle_t *out_handle)
{
    ESP_RETURN_ON_FALSE(config && out_handle && config->hx711 && config->nvs_key,
                        ESP_ERR_INVALID_ARG, TAG, "null arg");
    *out_handle = NULL;

    const size_t key_len = strlen(config->nvs_key);
    ESP_RETURN_ON_FALSE(key_len > 0 && key_len <= LOAD_CELL_NVS_KEY_MAX_LEN, ESP_ERR_INVALID_ARG,
                        TAG, "nvs_key must be 1..%d characters", LOAD_CELL_NVS_KEY_MAX_LEN);

    struct load_cell_t *dev = calloc(1, sizeof(*dev));
    ESP_RETURN_ON_FALSE(dev, ESP_ERR_NO_MEM, TAG, "no memory");
    dev->hx711 = config->hx711;
    memcpy(dev->nvs_key, config->nvs_key, key_len + 1); /* +1 copies the '\0' terminator */

    *out_handle = dev;
    return ESP_OK;
}

esp_err_t load_cell_load_calibration(load_cell_handle_t handle)
{
    ESP_RETURN_ON_FALSE(handle, ESP_ERR_INVALID_ARG, TAG, "null handle");

    nvs_handle_t nvs;
    esp_err_t err = nvs_open(LOAD_CELL_NVS_NAMESPACE, NVS_READONLY, &nvs);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        return ESP_ERR_NOT_FOUND; /* namespace never written: first boot */
    }
    ESP_RETURN_ON_ERROR(err, TAG, "nvs_open failed");

    load_cell_nvs_blob_t blob;
    size_t size = sizeof(blob);
    err = nvs_get_blob(nvs, handle->nvs_key, &blob, &size);
    nvs_close(nvs);

    if (err == ESP_ERR_NVS_NOT_FOUND) {
        return ESP_ERR_NOT_FOUND;
    }
    ESP_RETURN_ON_ERROR(err, TAG, "[%s] nvs_get_blob failed", handle->nvs_key);

    if (size != sizeof(blob) || blob.version != LOAD_CELL_NVS_BLOB_VERSION ||
        !isfinite(blob.counts_per_gram) ||
        fabsf(blob.counts_per_gram) < LOAD_CELL_MIN_COUNTS_PER_GRAM) {
        ESP_LOGW(TAG, "[%s] saved calibration is old or invalid; ignoring it", handle->nvs_key);
        return ESP_ERR_NOT_FOUND;
    }

    handle->cal.offset_raw = blob.offset_raw;
    handle->cal.counts_per_gram = blob.counts_per_gram;
    handle->tared = true;
    handle->calibrated = true;
    return ESP_OK;
}

esp_err_t load_cell_save_calibration(load_cell_handle_t handle)
{
    ESP_RETURN_ON_FALSE(handle, ESP_ERR_INVALID_ARG, TAG, "null handle");
    ESP_RETURN_ON_FALSE(handle->tared && handle->calibrated, ESP_ERR_INVALID_STATE, TAG,
                        "[%s] nothing to save: tare and calibrate first", handle->nvs_key);

    const load_cell_nvs_blob_t blob = {
        .version = LOAD_CELL_NVS_BLOB_VERSION,
        .offset_raw = handle->cal.offset_raw,
        .counts_per_gram = handle->cal.counts_per_gram,
    };

    nvs_handle_t nvs;
    ESP_RETURN_ON_ERROR(nvs_open(LOAD_CELL_NVS_NAMESPACE, NVS_READWRITE, &nvs), TAG,
                        "nvs_open failed");
    esp_err_t err = nvs_set_blob(nvs, handle->nvs_key, &blob, sizeof(blob));
    if (err == ESP_OK) {
        err = nvs_commit(nvs); /* nothing is guaranteed to be in flash before commit */
    }
    nvs_close(nvs);

    ESP_RETURN_ON_ERROR(err, TAG, "[%s] saving calibration failed", handle->nvs_key);
    ESP_LOGI(TAG, "[%s] calibration saved", handle->nvs_key);
    return ESP_OK;
}

esp_err_t load_cell_tare(load_cell_handle_t handle)
{
    ESP_RETURN_ON_FALSE(handle, ESP_ERR_INVALID_ARG, TAG, "null handle");

    int32_t mean;
    int32_t spread;
    bool stable;
    ESP_RETURN_ON_ERROR(measure(handle, LOAD_CELL_CAL_SAMPLES, true, &mean, &spread, &stable),
                        TAG, "[%s] tare failed", handle->nvs_key);

    handle->cal.offset_raw = mean;
    handle->tared = true;
    ESP_LOGI(TAG, "[%s] tare done: offset %" PRId32 " counts (spread %" PRId32 ")",
             handle->nvs_key, mean, spread);
    return ESP_OK;
}

esp_err_t load_cell_wait_for_load(load_cell_handle_t handle, int32_t min_net_raw,
                                  uint32_t timeout_ms)
{
    ESP_RETURN_ON_FALSE(handle && min_net_raw > 0, ESP_ERR_INVALID_ARG, TAG, "bad arg");
    ESP_RETURN_ON_FALSE(handle->tared, ESP_ERR_INVALID_STATE, TAG, "[%s] tare first",
                        handle->nvs_key);

    const TickType_t start = xTaskGetTickCount();
    const TickType_t timeout = pdMS_TO_TICKS(timeout_ms);

    while (true) {
        int32_t mean;
        int32_t spread;
        ESP_RETURN_ON_ERROR(sample_burst(handle, LOAD_CELL_DETECT_SAMPLES, &mean, &spread), TAG,
                            "[%s] sampling failed", handle->nvs_key);

        /* Either direction counts: if A+/A- are swapped, adding weight lowers the value. */
        const int32_t net = mean - handle->cal.offset_raw;
        if (net >= min_net_raw || net <= -min_net_raw) {
            ESP_LOGI(TAG, "[%s] load detected (net %" PRId32 " counts)", handle->nvs_key, net);
            return ESP_OK;
        }

        if ((xTaskGetTickCount() - start) >= timeout) {
            return ESP_ERR_TIMEOUT;
        }
        vTaskDelay(pdMS_TO_TICKS(LOAD_CELL_DETECT_POLL_MS));
    }
}

esp_err_t load_cell_calibrate(load_cell_handle_t handle, int32_t known_mass_g)
{
    ESP_RETURN_ON_FALSE(handle && known_mass_g > 0, ESP_ERR_INVALID_ARG, TAG, "bad arg");
    ESP_RETURN_ON_FALSE(handle->tared, ESP_ERR_INVALID_STATE, TAG, "[%s] tare first",
                        handle->nvs_key);

    int32_t mean;
    int32_t spread;
    bool stable;
    ESP_RETURN_ON_ERROR(measure(handle, LOAD_CELL_CAL_SAMPLES, true, &mean, &spread, &stable),
                        TAG, "[%s] calibration measurement failed", handle->nvs_key);

    const int32_t net = mean - handle->cal.offset_raw;
    const float counts_per_gram = (float)net / (float)known_mass_g;

    ESP_RETURN_ON_FALSE(fabsf(counts_per_gram) >= LOAD_CELL_MIN_COUNTS_PER_GRAM,
                        ESP_ERR_INVALID_RESPONSE, TAG,
                        "[%s] only %.2f counts/g: is the item on the cell? wiring?",
                        handle->nvs_key, counts_per_gram);

    handle->cal.counts_per_gram = counts_per_gram;
    handle->calibrated = true;
    ESP_LOGI(TAG, "[%s] calibrated: %.2f counts/g (net %" PRId32 " counts for %" PRId32 " g)",
             handle->nvs_key, counts_per_gram, net, known_mass_g);
    return ESP_OK;
}

esp_err_t load_cell_read(load_cell_handle_t handle, load_cell_reading_t *out)
{
    ESP_RETURN_ON_FALSE(handle && out, ESP_ERR_INVALID_ARG, TAG, "null arg");
    ESP_RETURN_ON_FALSE(handle->tared && handle->calibrated, ESP_ERR_INVALID_STATE, TAG,
                        "[%s] not calibrated", handle->nvs_key);

    int32_t mean;
    int32_t spread;
    bool stable;
    ESP_RETURN_ON_ERROR(measure(handle, LOAD_CELL_READ_SAMPLES, false, &mean, &spread, &stable),
                        TAG, "[%s] read failed", handle->nvs_key);

    const float grams = (float)(mean - handle->cal.offset_raw) / handle->cal.counts_per_gram;

    out->grams = (int32_t)lroundf(grams);
    out->raw = mean;
    out->spread_raw = spread;
    out->stable = stable;
    return ESP_OK;
}

esp_err_t load_cell_get_calibration(load_cell_handle_t handle, load_cell_calibration_t *out)
{
    ESP_RETURN_ON_FALSE(handle && out, ESP_ERR_INVALID_ARG, TAG, "null arg");
    ESP_RETURN_ON_FALSE(handle->tared && handle->calibrated, ESP_ERR_INVALID_STATE, TAG,
                        "[%s] not calibrated", handle->nvs_key);
    *out = handle->cal;
    return ESP_OK;
}

esp_err_t load_cell_deinit(load_cell_handle_t handle)
{
    ESP_RETURN_ON_FALSE(handle, ESP_ERR_INVALID_ARG, TAG, "null handle");
    free(handle);
    return ESP_OK;
}
