from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    StockMovementViewSet,
    StockViewSet,
    WarehouseViewSet,
)


router = DefaultRouter()

router.register(
    "warehouses",
    WarehouseViewSet,
    basename="warehouse",
)

router.register(
    "stocks",
    StockViewSet,
    basename="stock",
)

router.register(
    "movements",
    StockMovementViewSet,
    basename="stock-movement",
)


urlpatterns = [
    path(
        "",
        include(router.urls),
    ),
]