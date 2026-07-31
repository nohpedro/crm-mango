from django_filters import rest_framework as filters

from .models import Client


class ClientFilter(filters.FilterSet):
    price_level = filters.UUIDFilter(field_name="price_level_id")

    class Meta:
        model = Client
        fields = ["department", "city_zone", "client_type", "price_level", "is_active"]
