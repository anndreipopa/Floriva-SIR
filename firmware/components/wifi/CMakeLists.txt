idf_component_register(
    SRCS "wifi.c"
    INCLUDE_DIRS "."
    REQUIRES driver freertos log esp_wifi esp_netif esp_event
)