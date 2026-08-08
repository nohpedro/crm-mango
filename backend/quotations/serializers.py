from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from products.models import PriceTier, ProductPrice
from users.permissions import HasRoleModelPermission

from .models import Quotation, QuotationItem, QuotationTemplate, QuotationTemplateImage
from .template_defaults import (
    default_template_layout,
    default_template_sections,
    arranged_template_sections,
    constrained_template_layout,
    normalized_template_layout,
    normalized_template_sections,
)


class QuotationTemplateImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationTemplateImage
        fields = ["id", "template", "image", "alt_text", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_image(self, value):
        if value.content_type not in {"image/jpeg", "image/png", "image/webp"}:
            raise serializers.ValidationError("Usa una imagen JPG, PNG o WEBP.")
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("La imagen no puede superar 5 MB.")
        return value


class QuotationTemplateSerializer(serializers.ModelSerializer):
    images = QuotationTemplateImageSerializer(many=True, read_only=True)

    class Meta:
        model = QuotationTemplate
        fields = ["id", "name", "description", "sections", "layout", "images", "is_active", "is_default", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_sections(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Las secciones deben ser una lista.")
        return normalized_template_sections(value)

    def validate_layout(self, value):
        return normalized_template_layout(value)

    def validate(self, attrs):
        template = self.instance
        is_default = attrs.get(
            "is_default",
            template.is_default if template else False,
        )
        if is_default:
            attrs["is_active"] = True
        sections = attrs.get("sections", template.sections if template else [])
        layout = attrs.get("layout", template.layout if template else default_template_layout())
        columns = layout.get("columns", 1)
        for section in sections:
            section["grid_column"] = min(max(1, section.get("grid_column", 1)), columns)
            section["column_span"] = min(max(1, section.get("column_span", 1)), columns - section["grid_column"] + 1)
        arranged_sections = arranged_template_sections(sections, columns)
        if "sections" in attrs:
            attrs["sections"] = arranged_sections
        attrs["layout"] = constrained_template_layout(layout, arranged_sections)
        image_ids = {
            section.get("image_id")
            for section in sections
            if section.get("type") == "image" and section.get("image_id") is not None
        }
        if layout.get("header_image_id") is not None:
            image_ids.add(layout["header_image_id"])
        if image_ids and (not template or template.images.filter(id__in=image_ids).count() != len(image_ids)):
            raise serializers.ValidationError("Las imágenes seleccionadas deben pertenecer a esta plantilla.")
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        if validated_data.get("is_default"):
            QuotationTemplate.objects.filter(is_default=True).update(
                is_default=False
            )
        return super().create(validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        if validated_data.get("is_default"):
            QuotationTemplate.objects.filter(is_default=True).exclude(
                pk=instance.pk
            ).update(is_default=False)
        return super().update(instance, validated_data)


class QuotationItemSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    savings = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = QuotationItem
        fields = [
            "id", "product", "sku", "name", "quantity", "normal_unit_price", "special_unit_price",
            "applied_price_level", "additional_discount_percent", "unit_price", "savings", "total",
        ]
        read_only_fields = [
            "id", "sku", "name", "normal_unit_price", "special_unit_price", "applied_price_level",
            "unit_price", "savings", "total",
        ]

    def validate(self, attrs):
        product = attrs.get("product")
        if product and (not product.is_active or product.deleted_at):
            raise serializers.ValidationError({"product": "El producto seleccionado no está disponible."})
        return attrs


class QuotationSerializer(serializers.ModelSerializer):
    items = QuotationItemSerializer(many=True)
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_savings = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    template_name = serializers.CharField(source="template.name", read_only=True)
    quotation_date = serializers.DateField(
        required=False,
        error_messages={
            "invalid": "Ingresa una fecha válida con el formato AAAA-MM-DD.",
            "null": "Selecciona la fecha de la cotización.",
        },
    )

    class Meta:
        model = Quotation
        fields = [
            "id", "number", "client", "client_name", "client_tax_id", "client_phone", "client_address",
            "template", "template_name", "valid_days", "notes", "status", "quotation_date", "items", "total", "total_savings", "created_by", "created_by_name",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "number", "template_name", "total", "total_savings", "created_by", "created_by_name", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() or obj.created_by.username if obj.created_by else ""

    def get_total_savings(self, obj):
        return sum((item.savings for item in obj.items.all()), Decimal("0.00"))

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("Agrega al menos un producto a la cotización.")
        return value

    def validate(self, attrs):
        if ({"template", "valid_days"} & attrs.keys()) and not self._can_configure_document():
            raise serializers.ValidationError({
                "template": "No tienes permiso para cambiar la configuración del documento."
            })
        client = attrs.get("client", getattr(self.instance, "client", None))
        if "client" in attrs and client and not attrs.get("client_name"):
            attrs.update({
                "client_name": client.name, "client_tax_id": client.tax_id,
                "client_phone": client.whatsapp, "client_address": f"{client.city_zone}, {client.department}",
            })
        client_name = attrs.get(
            "client_name",
            getattr(self.instance, "client_name", ""),
        )
        if not client_name:
            raise serializers.ValidationError({"client_name": "Indica el nombre del cliente."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop("items")
        total_quantity = sum(item["quantity"] for item in items)
        if "template" not in validated_data:
            validated_data["template"] = (
                QuotationTemplate.objects.filter(is_active=True, is_default=True).first()
            )
        validated_data["template_snapshot"] = self._template_snapshot(validated_data.get("template"))
        quotation = Quotation.objects.create(**validated_data)
        for item in items:
            create_priced_item(quotation, item, total_quantity)
        return quotation

    @transaction.atomic
    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        if "template" in validated_data:
            instance.template_snapshot = self._template_snapshot(validated_data["template"])
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items is not None:
            total_quantity = sum(item["quantity"] for item in items)
            instance.items.all().delete()
            for item in items:
                create_priced_item(instance, item, total_quantity)
        return instance

    def _can_configure_document(self):
        if self.context.get("allow_document_configuration") is True:
            return True
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return any(
            HasRoleModelPermission._has_permission(user, permission)
            for permission in (
                "quotations.configure_quotation_document",
                "quotations.manage_quotation_templates",
            )
        )

    @staticmethod
    def _template_snapshot(template):
        images = []
        if template:
            images = [{"id": image.id, "path": image.image.path, "alt_text": image.alt_text} for image in template.images.all()]
        layout = normalized_template_layout(template.layout) if template else default_template_layout()
        sections = normalized_template_sections(template.sections) if template else normalized_template_sections(default_template_sections())
        sections = arranged_template_sections(sections, layout["columns"])
        layout = constrained_template_layout(layout, sections)
        return {
            "name": template.name if template else "Cotización IDESEM",
            "sections": sections,
            "layout": layout,
            "images": images,
        }


def create_priced_item(quotation, data, total_quantity):
    product, quantity = data["product"], data["quantity"]
    additional_discount = Decimal("0")
    normal_price = product.normal_unit_price
    level = quotation.client.price_level if quotation.client_id else None
    tier = PriceTier.objects.filter(
        price_level=level,
        minimum_quantity__lte=total_quantity,
        is_active=True,
    ).order_by("-minimum_quantity").first() if level else None
    configured = ProductPrice.objects.filter(product=product, price_tier=tier, is_active=True).order_by("-updated_at").first() if tier and tier.minimum_quantity > 1 else None
    special_price = configured.unit_price if configured else None
    final_price = special_price if special_price is not None else normal_price
    return QuotationItem.objects.create(
        quotation=quotation, product=product, sku=product.sku, name=product.name, quantity=quantity,
        normal_unit_price=normal_price, special_unit_price=special_price,
        applied_price_level=tier.label if tier else "",
        additional_discount_percent=additional_discount, unit_price=final_price,
    )
