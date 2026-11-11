idf_component_register(
    SRCS "load_cell.c"
    INCLUDE_DIRS "."
    REQUIRES hx711 nvs_flash freertos log
)
