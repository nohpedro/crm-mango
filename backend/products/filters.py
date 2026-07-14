import django_filters

from .models import Product, ProductPrice


class ProductFilter(django_filters.FilterSet):
    category = django_filters.UUIDFilter(
        field_name="category_id",
    )

    category_code = django_filters.CharFilter(
        field_name="category__code",
        lookup_expr="iexact",
    )

    name = django_filters.CharFilter(
        field_name="name",
        lookup_expr="icontains",
    )

    sku = django_filters.CharFilter(
        field_name="sku",
        lookup_expr="icontains",
    )

    barcode = django_filters.CharFilter(
        field_name="barcode",
        lookup_expr="icontains",
    )

    is_active = django_filters.BooleanFilter()

    class Meta:
        model = Product
        fields = [
            "category",
            "category_code",
            "name",
            "sku",
            "barcode",
            "is_active",
        ]


class ProductPriceFilter(django_filters.FilterSet):
    product = django_filters.UUIDFilter(
        field_name="product_id",
    )

    price_level = django_filters.UUIDFilter(
        field_name="price_level_id",
    )

    minimum_quantity = django_filters.NumberFilter()

    minimum_quantity_lte = django_filters.NumberFilter(
        field_name="minimum_quantity",
        lookup_expr="lte",
    )

    is_active = django_filters.BooleanFilter()

    class Meta:
        model = ProductPrice
        fields = [
            "product",
            "price_level",
            "minimum_quantity",
            "minimum_quantity_lte",
            "is_active",
        ]