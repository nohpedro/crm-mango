from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    PriceLevelViewSet,
    ProductImageViewSet,
    ProductPriceViewSet,
    ProductViewSet,
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
    path(
        "",
        include(router.urls),
    ),
]