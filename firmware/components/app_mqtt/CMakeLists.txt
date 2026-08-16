idf_component_register(
    SRCS "mqtt.c"
    INCLUDE_DIRS "."
    REQUIRES esp-tls json esp_event
    PRIV_REQUIRES mqtt
)