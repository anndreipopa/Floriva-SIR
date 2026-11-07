#pragma once

/* Copy this file to mqtt_config.h (gitignored) and fill in your own values.
 * Credentials come from the HiveMQ Cloud console (cluster -> Access Management). */
#define MQTT_BROKER_URI "mqtts://your-cluster-id.s1.eu.hivemq.cloud:8883"
#define MQTT_USERNAME "your-hivemq-username"
#define MQTT_PASSWORD "your-hivemq-password"
#define MQTT_TOPIC_SENSORS "floriva/floriva01/sensors"
