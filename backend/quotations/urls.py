from rest_framework.routers import DefaultRouter
from django.urls import path
from .transfer import QuotationTransferTemplateView, QuotationExportView, QuotationImportView, QuotationTransferReportView

from .views import QuotationTemplateImageViewSet, QuotationTemplateViewSet, QuotationViewSet

router = DefaultRouter()
router.register("template-images", QuotationTemplateImageViewSet, basename="quotation-template-image")
router.register("templates", QuotationTemplateViewSet, basename="quotation-template")
router.register("", QuotationViewSet, basename="quotation")

urlpatterns = [
    path("template/", QuotationTransferTemplateView.as_view()),
    path("export/", QuotationExportView.as_view()),
    path("import/", QuotationImportView.as_view()),
    path("report/", QuotationTransferReportView.as_view()),
] + router.urls
