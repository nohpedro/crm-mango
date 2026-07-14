from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from products.serializers import ProductListSerializer

from .models import (
    Stock,
    StockMovement,
    Warehouse,
)
from .services import register_stock_movement


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = (
            "id",
            "name",
            "code",
            "description",
            "address",
            "is_active",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
        )

        extra_kwargs = {
            "name": {
                "validators": [],
            },
            "code": {
                "validators": [],
            },
        }

    def validate_name(self, value):
        value = value.strip()

        queryset = Warehouse.objects.filter(
            name__iexact=value,
        )

        if self.instance:
            queryset = queryset.exclude(
                pk=self.instance.pk,
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "Ya existe un almacén con este nombre."
            )

        return value

    def validate_code(self, value):
        value = value.strip().upper()

        queryset = Warehouse.objects.filter(
            code__iexact=value,
        )

        if self.instance:
            queryset = queryset.exclude(
                pk=self.instance.pk,
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "Ya existe un almacén con este código."
            )

        return value


class WarehouseSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = (
            "id",
            "name",
            "code",
        )


class StockCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stock
        fields = (
            "id",
            "product",
            "warehouse",
            "minimum_stock",
        )

        read_only_fields = (
            "id",
        )

    def validate(self, attrs):
        product = attrs["product"]
        warehouse = attrs["warehouse"]

        if product.deleted_at:
            raise serializers.ValidationError(
                {
                    "product": (
                        "No se puede crear stock para "
                        "un producto eliminado."
                    )
                }
            )

        if not warehouse.is_active:
            raise serializers.ValidationError(
                {
                    "warehouse": (
                        "No se puede utilizar un almacén inactivo."
                    )
                }
            )

        if Stock.objects.filter(
            product=product,
            warehouse=warehouse,
        ).exists():
            raise serializers.ValidationError(
                "Ya existe un registro de stock para este "
                "producto y almacén."
            )

        return attrs


class StockUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stock
        fields = (
            "minimum_stock",
        )


class StockReadSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(
        read_only=True,
    )

    warehouse = WarehouseSummarySerializer(
        read_only=True,
    )

    available_quantity = serializers.IntegerField(
        read_only=True,
    )

    is_below_minimum = serializers.BooleanField(
        read_only=True,
    )

    class Meta:
        model = Stock
        fields = (
            "id",
            "product",
            "warehouse",
            "quantity",
            "reserved_quantity",
            "available_quantity",
            "minimum_stock",
            "is_below_minimum",
            "updated_at",
        )


class StockSummarySerializer(serializers.ModelSerializer):
    product_id = serializers.UUIDField(
        source="product.id",
        read_only=True,
    )

    product_name = serializers.CharField(
        source="product.name",
        read_only=True,
    )

    product_sku = serializers.CharField(
        source="product.sku",
        read_only=True,
    )

    warehouse_id = serializers.UUIDField(
        source="warehouse.id",
        read_only=True,
    )

    warehouse_name = serializers.CharField(
        source="warehouse.name",
        read_only=True,
    )

    class Meta:
        model = Stock
        fields = (
            "id",
            "product_id",
            "product_name",
            "product_sku",
            "warehouse_id",
            "warehouse_name",
        )


class StockMovementReadSerializer(serializers.ModelSerializer):
    stock = StockSummarySerializer(
        read_only=True,
    )

    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )

    movement_type_display = serializers.CharField(
        source="get_movement_type_display",
        read_only=True,
    )

    class Meta:
        model = StockMovement
        fields = (
            "id",
            "stock",
            "movement_type",
            "movement_type_display",
            "quantity_delta",
            "previous_quantity",
            "resulting_quantity",
            "reference",
            "notes",
            "created_by",
            "created_by_username",
            "created_at",
        )


class StockMovementCreateSerializer(serializers.Serializer):
    stock = serializers.PrimaryKeyRelatedField(
        queryset=Stock.objects.select_related(
            "product",
            "warehouse",
        ),
    )

    movement_type = serializers.ChoiceField(
        choices=StockMovement.MovementType.choices,
    )

    quantity = serializers.IntegerField(
        help_text=(
            "Para entradas y salidas debe ser positiva. "
            "Para ajustes puede ser positiva o negativa."
        ),
    )

    reference = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=120,
    )

    notes = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    def validate(self, attrs):
        movement_type = attrs["movement_type"]
        quantity = attrs["quantity"]

        if quantity == 0:
            raise serializers.ValidationError(
                {
                    "quantity": (
                        "La cantidad no puede ser cero."
                    )
                }
            )

        if (
            movement_type
            in {
                StockMovement.MovementType.ENTRY,
                StockMovement.MovementType.EXIT,
            }
            and quantity < 0
        ):
            raise serializers.ValidationError(
                {
                    "quantity": (
                        "Las entradas y salidas deben enviarse "
                        "como cantidades positivas."
                    )
                }
            )

        return attrs

    def create(self, validated_data):
        request = self.context["request"]

        try:
            return register_stock_movement(
                stock_id=validated_data["stock"].pk,
                movement_type=validated_data[
                    "movement_type"
                ],
                quantity=validated_data["quantity"],
                reference=validated_data.get(
                    "reference",
                    "",
                ),
                notes=validated_data.get(
                    "notes",
                    "",
                ),
                user=request.user,
            )
        except DjangoValidationError as error:
            if hasattr(error, "message_dict"):
                raise serializers.ValidationError(
                    error.message_dict
                ) from error

            raise serializers.ValidationError(
                error.messages
            ) from error

    def to_representation(self, instance):
        return StockMovementReadSerializer(
            instance,
            context=self.context,
        ).data