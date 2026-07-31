from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    StockMovementViewSet,
    StockViewSet,
    WarehouseViewSet,
)
from .transfer import InventoryReportView, StockExportView, StockImportView, StockTemplateView, WarehouseExportView, WarehouseImportView, WarehouseTemplateView


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
    path("warehouses/template/", WarehouseTemplateView.as_view()), path("warehouses/export/", WarehouseExportView.as_view()), path("warehouses/import/", WarehouseImportView.as_view()),
    path("stocks/template/", StockTemplateView.as_view()), path("stocks/export/", StockExportView.as_view()), path("stocks/import/", StockImportView.as_view()), path("transfer/report/", InventoryReportView.as_view()),
    path(
        "",
        include(router.urls),
    ),
]
