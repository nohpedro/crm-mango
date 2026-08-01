from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView
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


# La compilación de React se sirve desde el mismo host que la API. Este fallback
# permite actualizar cualquier ruta del SPA sin obtener un 404 de Django.
if (settings.BASE_DIR.parent / "frontend" / "dist" / "index.html").exists():
    urlpatterns += [
        re_path(
            r"^(?!api/|admin/|static/|media/).*$",
            TemplateView.as_view(template_name="index.html"),
            name="frontend",
        ),
    ]
