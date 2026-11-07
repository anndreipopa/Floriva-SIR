#pragma once

/**
 * Application-level constants for main.c.
 * Every tunable number lives here with a note on why it has that value.
 */

/* --- I2C bus (shared by BH1750 and HTU21D) --- */
#define I2C_SCL_GPIO 21
#define I2C_SDA_GPIO 22
/* Ignore I2C spikes shorter than this many clock cycles. */
#define I2C_GLITCH_FILTER_CYCLES 7

/* --- Sampling --- */
/* Readings averaged into one published value. Averaging smooths sensor noise. */
#define SENSOR_SAMPLES_PER_CYCLE 3
/* Pause between two samples inside one cycle. */
#define SENSOR_SAMPLE_GAP_MS 1000
/* One published reading every 3 minutes. The long pause also lets the HTU21D
 * cool down between measurements so its self-heating does not skew the result. */
#define SENSOR_PUBLISH_PERIOD_S 180

/* --- Temperature calibration --- */
/* The HTU21D read 0.7 degC higher than a reference thermometer, so this value is
 * subtracted from every averaged reading. Measured by comparison against a
 * reference thermometer; the date, conditions and reference model were not
 * recorded (TODO: re-measure and note them for the thesis). */
#define TEMP_CALIBRATION_OFFSET_C 0.7f
