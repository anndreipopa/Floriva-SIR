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

/* --- Load cell, pot 1 (HX711) --- */
/* DOUT may be an input-only pin (34-39); SCK must be able to output. HX711 powered at 3.3 V. */
#define HX711_POT1_DOUT_GPIO 34
#define HX711_POT1_SCK_GPIO 25
/* Pot number sent to the backend with each weighing (pots are numbered 1..3). */
#define WEIGHT_POT1_NUMBER 1
/* Key under which pot 1's calibration is saved in NVS (max 15 characters). */
#define WEIGHT_POT1_NVS_KEY "pot1"

/* --- Weighing schedule --- */
/* One weighing every 5 minutes while testing noise and creep. Planned: 7200 (2 h) later. */
#define WEIGHT_PERIOD_S 300
/* Wait after power-up before the tare or the first reading, so the load cell, the HX711 and
 * the regulator reach a steady temperature. STARTING VALUE, NOT MEASURED: the drift test will
 * show how long the readings really take to settle. Lower it (e.g. 10) while debugging. */
#define WEIGHT_WARMUP_S 300

/* --- Calibration (runs only when nothing is saved in NVS, or when forced) --- */
/* Mass of your reference item in grams. Weigh it on a trusted kitchen scale and put the number
 * here. Heavier is better (closer to the real pot load, smaller relative error), but stay well
 * under the 5 kg cell rating. 0 = not set yet: the build refuses to compile on purpose. */
#define WEIGHT_CAL_MASS_G 682
/* Net change in raw counts that counts as "item placed". About 50 g at the expected
 * ~400 counts/g: clearly above noise, clearly below any sensible reference item (>= 200 g). */
#define WEIGHT_CAL_DETECT_MIN_RAW 20000
/* Repeat the "place the item" message this often while waiting. */
#define WEIGHT_CAL_PROMPT_REPEAT_S 30
/* After the item is detected, wait this long (hands off, item stops wobbling) before measuring. */
#define WEIGHT_CAL_SETTLE_S 10
/* 1 = ignore the saved calibration and run the procedure again on next boot. Flash with 1,
 * let it finish, then set it back to 0 and flash again (otherwise it recalibrates every boot). */
#define WEIGHT_FORCE_CALIBRATION 0
