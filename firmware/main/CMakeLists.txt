idf_component_register(
    SRCS "main.c"
    INCLUDE_DIRS "." "../config"
    REQUIRES bh1750 htu21d wifi nvs_flash
)