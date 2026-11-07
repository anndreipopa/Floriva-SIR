# Floriva Firmware

ESP32 firmware for the Floriva plant-watering robot, written in C on [ESP-IDF](https://docs.espressif.com/projects/esp-idf/) 5.5.1. Every peripheral driver is written from the manufacturer's datasheet and packaged as a self-contained ESP-IDF component.

## Current functionality

- Reads ambient light (BH1750) and temperature/humidity (HTU21D) over I²C.
- Averages several samples per cycle to reduce noise.
- Connects to Wi-Fi in station mode and publishes readings as JSON over MQTT with TLS (HiveMQ Cloud, QoS 1).

Published payload, topic `floriva/floriva01/sensors`:

```json
{ "temperature": 22.4, "humidity": 55.1, "lux": 310.0 }
```

## Project structure

```
firmware/
├── main/                 Application entry point (app_main)
├── components/
│   ├── bh1750/           Light sensor driver
│   ├── htu21d/           Temperature and humidity sensor driver
│   ├── wifi/             Wi-Fi station manager (blocks until an IP is obtained, retries on disconnect)
│   └── app_mqtt/         MQTT-over-TLS client wrapper
├── config/               Wi-Fi and MQTT settings (git-ignored, see below)
├── sdkconfig.defaults    Project defaults for menuconfig
└── CMakeLists.txt
```

### Design conventions

- One driver per component, with a public header, an opaque handle and an `init` / `deinit` pair.
- Functions return `esp_err_t`; logging uses `ESP_LOGx` with a per-module tag.
- Uses the ESP-IDF 5.x `i2c_master` driver API.

## Hardware

| Signal | Pin |
|---|---|
| I²C SDA | GPIO 22 |
| I²C SCL | GPIO 21 |

Sensors: BH1750 (I²C address 0x23 or 0x5C) and HTU21D on a shared I²C bus. Pins for the load cells, stepper driver, limit switches and pump will be added as those features are implemented.

## Building

Requirements: ESP-IDF v5.5.x and an ESP32 development board.

1. Create the configuration headers in `config/`. They contain credentials and are excluded from version control:
   - `wifi_config.h`: Wi-Fi SSID and password.
   - `mqtt_config.h`: broker host, port, username, password and topic.
2. Build, flash and monitor (from an ESP-IDF terminal):

   ```bash
   idf.py set-target esp32
   idf.py build
   idf.py -p <PORT> flash monitor
   ```

## Roadmap

- [ ] HX711 driver with tare, calibration and outlier-rejecting filter (three channels)
- [ ] Limit-switch handling with debouncing
- [ ] Stepper control through a TMC2209 (STEP/DIR), acceleration ramps and homing
- [ ] Pump control with a maximum-runtime safeguard
- [ ] FreeRTOS task architecture (sensing, motion, watering state machine, communications)
- [ ] Fault handling: motor stall, empty tank, pump failure, invalid sensor data
- [ ] Calibration storage in NVS
- [ ] MQTT command and status channels

## Related

- [Project overview](../README.md)
- [Backend](../backend/README.md)
- [Frontend](../frontend/README.md)
