#pragma once

#include "esp_err.h"
#include <stdbool.h>
#include <stdint.h>

/* Longest command id accepted, without the terminating '\0'. 36 = a GUID as text
 * ("6f1c2a9e-0000-0000-0000-000000000000"). Longer ids are rejected, not cut short: two
 * different ids cut to the same prefix would look like a repeat and be ignored.
 * Allowed characters: letters, digits, '-' and '_' (so an id can go into JSON as is). */
#define APP_MQTT_CMD_ID_MAX_LEN 36

/* Valid pot numbers in a command (the robot has 3 pot slots, numbered from 1). */
#define APP_MQTT_POT_MIN 1
#define APP_MQTT_POT_MAX 3

/** One weighing, as sent on the weight topic. */
typedef struct {
    int pot;             /* 1..3 */
    int32_t grams;       /* rounded to whole grams */
    int32_t raw;         /* filtered raw HX711 counts (for drift analysis) */
    int32_t spread_raw;  /* noise indicator of this reading */
    bool stable;         /* false if the reading never settled */
    uint32_t uptime_s;   /* seconds since boot: lets the backend spot restarts */
    const char *session; /* calibration session id, or NULL for a normal reading */
} app_mqtt_weight_t;

/** What a command asks the robot to do (the "type" field on the cmd topic). */
typedef enum {
    APP_MQTT_CMD_CALIBRATION_START, /* "calibration_start": begin a live session */
    APP_MQTT_CMD_CALIBRATION_END,   /* "calibration_end": back to normal weighing */
} app_mqtt_cmd_type_t;

/** One command received on the cmd topic, already checked: every field is valid. */
typedef struct {
    char id[APP_MQTT_CMD_ID_MAX_LEN + 1]; /* unique per command; used to drop QoS 1 repeats */
    app_mqtt_cmd_type_t type;
    int pot; /* APP_MQTT_POT_MIN..APP_MQTT_POT_MAX */
} app_mqtt_cmd_t;

/**
 * Called for every valid command, from inside the MQTT library's task.
 * It must return quickly (copy the command into a queue, nothing more): while it runs, the
 * MQTT connection is not serviced. The command is only valid during the call.
 */
typedef void (*app_mqtt_cmd_handler_t)(const app_mqtt_cmd_t *cmd);

/** Measurement state of the device, as sent in the "state" field of the status topic. */
typedef enum {
    APP_MQTT_STATE_IDLE,       /* normal weighing on the long period */
    APP_MQTT_STATE_WARMING_UP, /* session started; user lifts the pot off before the tare */
    APP_MQTT_STATE_TARING,     /* measuring the empty cell */
    APP_MQTT_STATE_STREAMING,  /* a reading every few seconds, tagged with the session */
    APP_MQTT_STATE_ERROR,      /* the session failed; "error" says why */
} app_mqtt_device_state_t;

/** One message on the status topic. Also serves as the acknowledgement of a command. */
typedef struct {
    int pot;
    const char *session;           /* session id, or NULL ("session": null) */
    app_mqtt_device_state_t state;
    int seconds_left;              /* >= 0 only while warming up; < 0 leaves the field out */
    const char *error;             /* short snake_case code, or NULL to leave it out */
    uint32_t uptime_s;
} app_mqtt_status_t;

esp_err_t app_mqtt_init(void);
esp_err_t app_mqtt_publish_sensor_data(float temperature_c, float humidity_pct, float lux);

/**
 * Publish one weighing as JSON on MQTT_TOPIC_WEIGHT (QoS 1).
 * Safe to call from any task.
 *
 * @return ESP_OK, ESP_ERR_INVALID_ARG, ESP_ERR_INVALID_STATE if not connected (the reading
 *         is dropped, not queued), ESP_FAIL on an encoding or publish error
 */
esp_err_t app_mqtt_publish_weight(const app_mqtt_weight_t *weight);

/**
 * Publish the device state as JSON on MQTT_TOPIC_STATUS (QoS 1, not retained).
 * Safe to call from any task.
 *
 * @return ESP_OK, ESP_ERR_INVALID_ARG, ESP_ERR_INVALID_STATE if not connected (dropped),
 *         ESP_FAIL on an encoding or publish error
 */
esp_err_t app_mqtt_publish_status(const app_mqtt_status_t *status);

/**
 * Register the function that receives commands from the cmd topic (one handler; a second
 * call replaces the first). Call it before app_mqtt_init() so no command is missed.
 */
void app_mqtt_set_cmd_handler(app_mqtt_cmd_handler_t handler);

bool app_mqtt_is_connected(void);
