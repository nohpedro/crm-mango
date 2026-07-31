from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    PriceLevelViewSet,
    PriceTierViewSet,
    ProductImageViewSet,
    ProductPriceViewSet,
    ProductViewSet,
)
from .transfer import (
    ProductExportView,
    ProductImportView,
    ProductReportView,
    ProductTemplateView,
)


router = DefaultRouter()

router.register(
    "categories",
    CategoryViewSet,
    basename="category",
)

router.register(
    "price-levels",
    PriceLevelViewSet,
    basename="price-level",
)

router.register(
    "price-tiers",
    PriceTierViewSet,
    basename="price-tier",
)

router.register(
    "products",
    ProductViewSet,
    basename="product",
)

router.register(
    "product-prices",
    ProductPriceViewSet,
    basename="product-price",
)

router.register(
    "product-images",
    ProductImageViewSet,
    basename="product-image",
)


urlpatterns = [
    path("template/", ProductTemplateView.as_view()),
    path("export/", ProductExportView.as_view()),
    path("import/", ProductImportView.as_view()),
    path("report/", ProductReportView.as_view()),
    path(
        "",
        include(router.urls),
    ),
]
