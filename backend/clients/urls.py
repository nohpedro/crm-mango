from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ClientExportView,
    ClientImportView,
    ClientReportView,
    ClientTemplateView,
    ClientViewSet,
    ClientTypeViewSet,
)

router = DefaultRouter()
router.register("", ClientViewSet, basename="client")
type_router = DefaultRouter()
type_router.register("", ClientTypeViewSet, basename="client-type")

urlpatterns = [
    path("template/", ClientTemplateView.as_view()),
    path("export/", ClientExportView.as_view()),
    path("import/", ClientImportView.as_view()),
    path("report/", ClientReportView.as_view()),
    path("types/", include(type_router.urls)),
    path("", include(router.urls)),
]
