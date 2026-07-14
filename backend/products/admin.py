from django.contrib import admin

from .models import (
    Category,
    PriceLevel,
    Product,
    ProductImage,
    ProductPrice,
)


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0


class ProductPriceInline(admin.TabularInline):
    model = ProductPrice
    extra = 0


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "is_active",
        "created_at",
    )

    list_filter = (
        "is_active",
    )

    search_fields = (
        "name",
        "code",
    )


@admin.register(PriceLevel)
class PriceLevelAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "is_active",
    )

    list_filter = (
        "is_active",
    )

    search_fields = (
        "name",
        "code",
    )


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "sku",
        "name",
        "category",
        "is_active",
        "deleted_at",
        "created_at",
    )

    list_filter = (
        "is_active",
        "category",
    )

    search_fields = (
        "sku",
        "barcode",
        "name",
        "description",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
        "deleted_at",
    )

    inlines = [
        ProductImageInline,
        ProductPriceInline,
    ]


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = (
        "product",
        "is_primary",
        "position",
        "created_at",
    )

    list_filter = (
        "is_primary",
    )

    search_fields = (
        "product__name",
        "product__sku",
    )


@admin.register(ProductPrice)
class ProductPriceAdmin(admin.ModelAdmin):
    list_display = (
        "product",
        "price_level",
        "minimum_quantity",
        "unit_price",
        "is_active",
    )

    list_filter = (
        "price_level",
        "is_active",
    )

    search_fields = (
        "product__name",
        "product__sku",
    )