from django.db import transaction
from rest_framework import serializers

from .models import (
    Category,
    PriceLevel,
    Product,
    ProductImage,
    ProductPrice,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = (
            "id",
            "name",
            "code",
            "description",
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

        queryset = Category.objects.filter(
            name__iexact=value,
        )

        if self.instance:
            queryset = queryset.exclude(
                pk=self.instance.pk,
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "Ya existe una categoría con este nombre."
            )

        return value

    def validate_code(self, value):
        value = value.strip().upper()

        queryset = Category.objects.filter(
            code__iexact=value,
        )

        if self.instance:
            queryset = queryset.exclude(
                pk=self.instance.pk,
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "Ya existe una categoría con este código."
            )

        return value


class CategorySummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = (
            "id",
            "name",
            "code",
        )


class PriceLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceLevel
        fields = (
            "id",
            "name",
            "code",
            "description",
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

        queryset = PriceLevel.objects.filter(
            name__iexact=value,
        )

        if self.instance:
            queryset = queryset.exclude(
                pk=self.instance.pk,
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "Ya existe un nivel con este nombre."
            )

        return value

    def validate_code(self, value):
        value = value.strip().upper()

        queryset = PriceLevel.objects.filter(
            code__iexact=value,
        )

        if self.instance:
            queryset = queryset.exclude(
                pk=self.instance.pk,
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "Ya existe un nivel con este código."
            )

        return value


class PriceLevelSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceLevel
        fields = (
            "id",
            "name",
            "code",
        )


class ProductPriceSerializer(serializers.ModelSerializer):
    price_level_detail = PriceLevelSummarySerializer(
        source="price_level",
        read_only=True,
    )

    class Meta:
        model = ProductPrice
        fields = (
            "id",
            "product",
            "price_level",
            "price_level_detail",
            "minimum_quantity",
            "unit_price",
            "is_active",
            "valid_from",
            "valid_until",
            "created_by",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "price_level_detail",
            "created_by",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        product = attrs.get(
            "product",
            getattr(self.instance, "product", None),
        )

        price_level = attrs.get(
            "price_level",
            getattr(self.instance, "price_level", None),
        )

        minimum_quantity = attrs.get(
            "minimum_quantity",
            getattr(self.instance, "minimum_quantity", None),
        )

        valid_from = attrs.get(
            "valid_from",
            getattr(self.instance, "valid_from", None),
        )

        valid_until = attrs.get(
            "valid_until",
            getattr(self.instance, "valid_until", None),
        )

        if (
            valid_from
            and valid_until
            and valid_until <= valid_from
        ):
            raise serializers.ValidationError(
                {
                    "valid_until": (
                        "La fecha final debe ser posterior "
                        "a la fecha inicial."
                    )
                }
            )

        queryset = ProductPrice.objects.filter(
            product=product,
            price_level=price_level,
            minimum_quantity=minimum_quantity,
        )

        if self.instance:
            queryset = queryset.exclude(
                pk=self.instance.pk,
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "Ya existe un precio para este producto, "
                "nivel y cantidad mínima."
            )

        return attrs


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = (
            "id",
            "product",
            "image",
            "alt_text",
            "is_primary",
            "position",
            "created_at",
        )

        read_only_fields = (
            "id",
            "created_at",
        )

    @transaction.atomic
    def create(self, validated_data):
        product = validated_data["product"]

        if validated_data.get("is_primary"):
            ProductImage.objects.filter(
                product=product,
                is_primary=True,
            ).update(is_primary=False)

        return super().create(validated_data)

    def validate_image(self, value):
        content_type = getattr(value, "content_type", "")
        if content_type and content_type not in {
            "image/jpeg",
            "image/png",
            "image/webp",
        }:
            raise serializers.ValidationError(
                "Solo se permiten imágenes JPG, PNG o WebP."
            )
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError(
                "La imagen no puede superar los 5 MB."
            )
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        image_url = data.get("image")
        if request and image_url and not image_url.startswith("http"):
            data["image"] = request.build_absolute_uri(image_url)
        return data

    @transaction.atomic
    def update(self, instance, validated_data):
        product = validated_data.get(
            "product",
            instance.product,
        )

        if validated_data.get("is_primary"):
            ProductImage.objects.filter(
                product=product,
                is_primary=True,
            ).exclude(
                pk=instance.pk,
            ).update(is_primary=False)

        return super().update(
            instance,
            validated_data,
        )


class ProductWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = (
            "id",
            "category",
            "name",
            "sku",
            "barcode",
            "description",
            "is_active",
        )

        read_only_fields = (
            "id",
        )

        extra_kwargs = {
            "sku": {
                "validators": [],
            },
            "barcode": {
                "validators": [],
            },
        }

    def validate_category(self, value):
        if not value.is_active:
            raise serializers.ValidationError(
                "No se puede asignar una categoría inactiva."
            )

        return value

    def validate_sku(self, value):
        value = value.strip().upper()

        queryset = Product.objects.filter(
            sku__iexact=value,
        )

        if self.instance:
            queryset = queryset.exclude(
                pk=self.instance.pk,
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "Ya existe un producto con este SKU."
            )

        return value

    def validate_barcode(self, value):
        if not value:
            return None

        value = value.strip()

        queryset = Product.objects.filter(
            barcode=value,
        )

        if self.instance:
            queryset = queryset.exclude(
                pk=self.instance.pk,
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "Ya existe un producto con este código de barras."
            )

        return value

    def validate(self, attrs):
        category = attrs.get(
            "category",
            getattr(self.instance, "category", None),
        )

        name = attrs.get(
            "name",
            getattr(self.instance, "name", ""),
        ).strip()

        queryset = Product.objects.filter(
            category=category,
            name__iexact=name,
        )

        if self.instance:
            queryset = queryset.exclude(
                pk=self.instance.pk,
            )

        if queryset.exists():
            raise serializers.ValidationError(
                {
                    "name": (
                        "Ya existe un producto con este nombre "
                        "dentro de la categoría."
                    )
                }
            )

        attrs["name"] = name

        return attrs


class ProductListSerializer(serializers.ModelSerializer):
    category = CategorySummarySerializer(
        read_only=True,
    )

    primary_image = serializers.SerializerMethodField()

    total_stock = serializers.SerializerMethodField()

    available_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "sku",
            "barcode",
            "category",
            "is_active",
            "deleted_at",
            "primary_image",
            "total_stock",
            "available_stock",
            "created_at",
            "updated_at",
        )

    def get_primary_image(self, obj):
        image = next(
            (
                item
                for item in obj.images.all()
                if item.is_primary
            ),
            None,
        )

        if image is None:
            return None

        request = self.context.get("request")

        if request:
            return request.build_absolute_uri(
                image.image.url,
            )

        return image.image.url

    def get_total_stock(self, obj):
        return sum(
            stock.quantity
            for stock in obj.stocks.all()
        )

    def get_available_stock(self, obj):
        return sum(
            stock.available_quantity
            for stock in obj.stocks.all()
        )


class ProductDetailSerializer(ProductListSerializer):
    images = ProductImageSerializer(
        many=True,
        read_only=True,
    )

    prices = ProductPriceSerializer(
        many=True,
        read_only=True,
    )

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + (
            "description",
            "images",
            "prices",
            "created_by",
            "updated_by",
        )
