from django.contrib import admin

from .models import (
    Stock,
    StockMovement,
    Warehouse,
)


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "is_active",
        "created_at",
    )

    list_filter = (
        "is_active",
    )

    search_fields = (
        "code",
        "name",
        "address",
    )


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = (
        "product",
        "warehouse",
        "quantity",
        "reserved_quantity",
        "available_quantity",
        "minimum_stock",
        "is_below_minimum",
        "updated_at",
    )

    list_filter = (
        "warehouse",
    )

    search_fields = (
        "product__name",
        "product__sku",
        "warehouse__name",
        "warehouse__code",
    )

    readonly_fields = (
        "updated_at",
    )


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = (
        "stock",
        "movement_type",
        "quantity_delta",
        "previous_quantity",
        "resulting_quantity",
        "created_by",
        "created_at",
    )

    list_filter = (
        "movement_type",
        "stock__warehouse",
    )

    search_fields = (
        "stock__product__name",
        "stock__product__sku",
        "reference",
        "notes",
    )

    readonly_fields = (
        "previous_quantity",
        "resulting_quantity",
        "created_by",
        "created_at",
    )