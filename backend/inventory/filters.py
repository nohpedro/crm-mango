import django_filters

from .models import Stock, StockMovement


class StockFilter(django_filters.FilterSet):
    product = django_filters.UUIDFilter(
        field_name="product_id",
    )

    warehouse = django_filters.UUIDFilter(
        field_name="warehouse_id",
    )

    product_sku = django_filters.CharFilter(
        field_name="product__sku",
        lookup_expr="icontains",
    )

    quantity_lte = django_filters.NumberFilter(
        field_name="quantity",
        lookup_expr="lte",
    )

    quantity_gte = django_filters.NumberFilter(
        field_name="quantity",
        lookup_expr="gte",
    )

    class Meta:
        model = Stock
        fields = [
            "product",
            "warehouse",
            "product_sku",
            "quantity_lte",
            "quantity_gte",
        ]


class StockMovementFilter(django_filters.FilterSet):
    stock = django_filters.UUIDFilter(
        field_name="stock_id",
    )

    product = django_filters.UUIDFilter(
        field_name="stock__product_id",
    )

    warehouse = django_filters.UUIDFilter(
        field_name="stock__warehouse_id",
    )

    movement_type = django_filters.CharFilter(
        lookup_expr="iexact",
    )

    created_from = django_filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="gte",
    )

    created_until = django_filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="lte",
    )

    class Meta:
        model = StockMovement
        fields = [
            "stock",
            "product",
            "warehouse",
            "movement_type",
            "created_from",
            "created_until",
        ]