from rest_framework import serializers

from .models import Client, ClientType


class ClientTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientType
        fields = ("id", "name", "is_active")
        read_only_fields = ("id",)

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El nombre es obligatorio.")
        queryset = ClientType.objects.filter(name__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Ya existe un tipo de cliente con ese nombre.")
        return value


class ClientReadSerializer(serializers.ModelSerializer):
    price_level = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = (
            "id",
            "name",
            "tax_id",
            "department",
            "city_zone",
            "whatsapp",
            "client_type",
            "price_level",
            "business_activity",
            "observations",
            "is_active",
            "created_at",
            "updated_at",
        )

    def get_price_level(self, obj):
        return {
            "id": str(obj.price_level_id),
            "name": obj.price_level.name,
            "code": obj.price_level.code,
        }


class ClientWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = (
            "id",
            "name",
            "tax_id",
            "department",
            "city_zone",
            "whatsapp",
            "client_type",
            "price_level",
            "business_activity",
            "observations",
            "is_active",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        for field in (
            "name",
            "tax_id",
            "department",
            "city_zone",
            "whatsapp",
            "business_activity",
        ):
            value = attrs.get(field)
            if value is not None and any(ord(char) < 32 for char in value):
                raise serializers.ValidationError({field: "No puede contener caracteres de control."})
        client_type = attrs.get("client_type")
        if client_type and not ClientType.objects.filter(name__iexact=client_type, is_active=True).exists():
            raise serializers.ValidationError({"client_type": "Selecciona un tipo de cliente válido."})
        return attrs

    def to_representation(self, instance):
        return ClientReadSerializer(instance, context=self.context).data
