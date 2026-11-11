idf_component_register(
    SRCS "weight_task.c" "main.c"
    INCLUDE_DIRS "." "../config"
    REQUIRES bh1750 htu21d wifi nvs_flash app_mqtt hx711 load_cell
)