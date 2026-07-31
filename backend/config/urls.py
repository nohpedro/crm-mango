from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)


urlpatterns = [
    path(
        "admin/",
        admin.site.urls,
    ),

    path(
        "api/schema/",
        SpectacularAPIView.as_view(),
        name="api-schema",
    ),

    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(
            url_name="api-schema",
        ),
        name="swagger-ui",
    ),

    path(
        "api/redoc/",
        SpectacularRedocView.as_view(
            url_name="api-schema",
        ),
        name="redoc",
    ),

    path(
        "api/v1/",
        include("users.urls"),
    ),

    path(
        "api/v1/catalog/",
        include("products.urls"),
    ),

    path(
        "api/v1/inventory/",
        include("inventory.urls"),
    ),

    path(
        "api/v1/clients/",
        include("clients.urls"),
    ),

    path(
        "api/v1/quotations/",
        include("quotations.urls"),
    ),
]


if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )
