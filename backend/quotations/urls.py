from rest_framework.routers import DefaultRouter

from .views import QuotationTemplateImageViewSet, QuotationTemplateViewSet, QuotationViewSet

router = DefaultRouter()
router.register("template-images", QuotationTemplateImageViewSet, basename="quotation-template-image")
router.register("templates", QuotationTemplateViewSet, basename="quotation-template")
router.register("", QuotationViewSet, basename="quotation")

urlpatterns = router.urls
