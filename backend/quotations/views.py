from django.http import HttpResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from users.permissions import HasRoleModelPermission

from .models import Quotation, QuotationTemplate, QuotationTemplateImage
from .pdf import quotation_pdf
from .reports import (
    dashboard_data,
    dashboard_day_data,
    report_csv as build_report_csv,
    report_pdf as build_report_pdf,
)
from .serializers import QuotationSerializer, QuotationTemplateImageSerializer, QuotationTemplateSerializer


class QuotationTemplateViewSet(viewsets.ModelViewSet):
    queryset = QuotationTemplate.objects.order_by(
        "-is_default",
        "-is_active",
        "name",
    )
    serializer_class = QuotationTemplateSerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            self.required_any_permissions = (
                "quotations.configure_quotation_document",
                "quotations.manage_quotation_templates",
            )
        else:
            self.required_permission = "quotations.manage_quotation_templates"
        return [HasRoleModelPermission()]


class QuotationTemplateImageViewSet(viewsets.ModelViewSet):
    serializer_class = QuotationTemplateImageSerializer
    parser_classes = [MultiPartParser, FormParser]
    queryset = QuotationTemplateImage.objects.select_related("template")

    def get_queryset(self):
        queryset = super().get_queryset()
        template_id = self.request.query_params.get("template")
        return queryset.filter(template_id=template_id) if template_id else queryset

    def get_permissions(self):
        self.required_permission = "quotations.manage_quotation_templates"
        return [HasRoleModelPermission()]


class QuotationViewSet(viewsets.ModelViewSet):
    serializer_class = QuotationSerializer
    permission_classes = [HasRoleModelPermission]
    queryset = Quotation.objects.select_related("client", "created_by").prefetch_related("items", "items__product")
    search_fields = ["number", "client_name", "client_tax_id", "items__name", "items__sku"]
    filterset_fields = ["status", "client", "quotation_date"]
    ordering_fields = ["number", "quotation_date", "created_at", "updated_at", "status"]
    ordering = ["-quotation_date", "-created_at"]

    def get_permissions(self):
        if self.action in {"dashboard", "dashboard_day", "report_pdf", "report_csv"}:
            self.required_permission = "quotations.view_dashboard"
        elif (
            self.action == "partial_update"
            and "status" in self.request.data
            and set(self.request.data).issubset({"status"})
        ):
            self.required_any_permissions = (
                "quotations.change_quotation_status",
                "quotations.change_quotation",
            )
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @extend_schema(parameters=[OpenApiParameter(name="paper", type=str, enum=["standard", "roll"])])
    @action(detail=True, methods=["get"])
    def pdf(self, request, *args, **kwargs):
        quotation = self.get_object()
        paper = request.query_params.get("paper", "standard")
        if paper not in {"standard", "roll"}:
            paper = "standard"
        response = HttpResponse(quotation_pdf(quotation, paper), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{quotation.number}-{paper}.pdf"'
        return response

    @action(detail=False, methods=["get"])
    def dashboard(self, request):
        try:
            data = dashboard_data(
                request.query_params.get("period", "month"),
                start_date=request.query_params.get("start_date"),
                end_date=request.query_params.get("end_date"),
                quotation_status=request.query_params.get("status", "all"),
            )
        except ValueError as error:
            return Response({"detail": str(error)}, status=400)
        return Response(data)

    @action(detail=False, methods=["get"], url_path="dashboard-day")
    def dashboard_day(self, request):
        try:
            data = dashboard_day_data(
                request.query_params.get("date"),
                quotation_status=request.query_params.get("status", "all"),
            )
        except ValueError as error:
            return Response({"detail": str(error)}, status=400)
        return Response(data)

    @action(detail=False, methods=["get"], url_path="report-pdf")
    def report_pdf(self, request):
        period = request.query_params.get("period", "month")
        try:
            content = build_report_pdf(
                period,
                start_date=request.query_params.get("start_date"),
                end_date=request.query_params.get("end_date"),
                quotation_status=request.query_params.get("status", "all"),
            )
        except ValueError as error:
            return Response({"detail": str(error)}, status=400)
        response = HttpResponse(content, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="reporte-ventas-{period}.pdf"'
        )
        return response

    @action(detail=False, methods=["get"], url_path="report-csv")
    def report_csv(self, request):
        period = request.query_params.get("period", "month")
        try:
            content = build_report_csv(
                period,
                start_date=request.query_params.get("start_date"),
                end_date=request.query_params.get("end_date"),
                quotation_status=request.query_params.get("status", "all"),
            )
        except ValueError as error:
            return Response({"detail": str(error)}, status=400)
        response = HttpResponse(content, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = (
            f'attachment; filename="datos-ventas-{period}.csv"'
        )
        return response
