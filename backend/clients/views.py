import re
import unicodedata

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

from idesem.excel import ExcelDependencyError, parse_bool, read_rows, write_error_report, write_workbook
from products.models import PriceLevel
from users.permissions import HasRoleModelPermission

from .filters import ClientFilter
from .models import Client, ClientType
from .serializers import ClientReadSerializer, ClientTypeSerializer, ClientWriteSerializer
from .analytics import client_analytics
from .reports import build_client_report_csv, build_client_report_pdf

CLIENT_HEADERS = [
    "Nombre o razón social",
    "NIT/CI",
    "Departamento",
    "Ciudad/Zona",
    "WhatsApp",
    "Tipo de cliente",
    "Nivel de precio",
    "Rubro o actividad",
    "Observaciones",
]
CLIENT_INSTRUCTIONS = [
    ("Nombre o razón social", "Obligatorio, máximo 200 caracteres."),
    ("NIT/CI", "Obligatorio, único, máximo 30 caracteres alfanuméricos."),
    ("Departamento", "Obligatorio, máximo 80 caracteres."),
    ("Ciudad/Zona", "Obligatorio, máximo 120 caracteres."),
    ("WhatsApp", "Obligatorio, máximo 30 caracteres."),
    ("Tipo de cliente", "Distribuidor o mayorista, Tienda o comercio, Técnico o instalador, Empresa o constructora, Institución o proyecto."),
    ("Nivel de precio", "Debe coincidir con el nombre o código de un nivel activo."),
    ("Rubro o actividad", "Obligatorio, máximo 200 caracteres."),
    ("Observaciones", "Opcional."),
]
def client_type_names():
    return set(ClientType.objects.filter(is_active=True).values_list("name", flat=True))


class ClientTypeViewSet(viewsets.ModelViewSet):
    queryset = ClientType.objects.all()
    serializer_class = ClientTypeSerializer
    permission_classes = [HasRoleModelPermission]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_permissions(self):
        return [HasRoleModelPermission()]


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.select_related("price_level").all()
    filterset_class = ClientFilter
    serializer_class = ClientReadSerializer
    permission_classes = [HasRoleModelPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "tax_id", "department", "city_zone", "whatsapp", "business_activity"]
    ordering_fields = ["name", "tax_id", "created_at", "updated_at"]
    ordering = ["name"]

    def get_permissions(self):
        if self.action in {"analytics", "analytics_report_pdf", "analytics_report_csv"}:
            self.required_all_permissions = (
                "clients.view_client",
                "quotations.view_quotation",
            )
        return [HasRoleModelPermission()]

    def get_serializer_class(self):
        return ClientWriteSerializer if self.action in {"create", "update", "partial_update"} else ClientReadSerializer

    @action(detail=True, methods=["get"])
    def analytics(self, request, *args, **kwargs):
        try:
            data = client_analytics(
                self.get_object(),
                start_date=request.query_params.get("start_date"),
                end_date=request.query_params.get("end_date"),
                quotation_status=request.query_params.get("status", "all"),
                page=request.query_params.get("page", 1),
                page_size=request.query_params.get("page_size", 10),
            )
        except ValueError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(data)

    @action(detail=True, methods=["get"], url_path="analytics-report-pdf")
    def analytics_report_pdf(self, request, *args, **kwargs):
        client = self.get_object()
        try:
            content = build_client_report_pdf(
                client,
                start_date=request.query_params.get("start_date"),
                end_date=request.query_params.get("end_date"),
                quotation_status=request.query_params.get("status", "all"),
            )
        except ValueError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        response = HttpResponse(content, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="reporte-cliente-{client.pk}.pdf"'
        return response

    @action(detail=True, methods=["get"], url_path="analytics-report-csv")
    def analytics_report_csv(self, request, *args, **kwargs):
        client = self.get_object()
        try:
            content = build_client_report_csv(
                client,
                start_date=request.query_params.get("start_date"),
                end_date=request.query_params.get("end_date"),
                quotation_status=request.query_params.get("status", "all"),
            )
        except ValueError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        response = HttpResponse(content, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="productos-cliente-{client.pk}.csv"'
        return response


class ClientTemplateView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "clients.view_client"

    def get(self, request):
        return _excel_response(CLIENT_HEADERS, [], "Plantilla_Clientes", CLIENT_INSTRUCTIONS)


class ClientExportView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "clients.view_client"

    def get(self, request):
        queryset = Client.objects.select_related("price_level").all()
        queryset = _filter_clients(queryset, request)
        rows = [
            {
                CLIENT_HEADERS[0]: item.name,
                CLIENT_HEADERS[1]: item.tax_id,
                CLIENT_HEADERS[2]: item.department,
                CLIENT_HEADERS[3]: item.city_zone,
                CLIENT_HEADERS[4]: item.whatsapp,
                CLIENT_HEADERS[5]: item.client_type,
                CLIENT_HEADERS[6]: item.price_level.code,
                CLIENT_HEADERS[7]: item.business_activity,
                CLIENT_HEADERS[8]: item.observations,
            }
            for item in queryset
        ]
        return _excel_response(CLIENT_HEADERS, rows, "Clientes", CLIENT_INSTRUCTIONS)


class ClientImportView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "clients.add_client"
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        upload = request.FILES.get("file")
        mode = request.data.get("mode", "partial")
        if not upload:
            return Response({"detail": "Selecciona un archivo Excel."}, status=status.HTTP_400_BAD_REQUEST)
        if mode not in {"partial", "total"}:
            return Response({"detail": "El modo debe ser partial o total."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            rows = read_rows(upload, CLIENT_HEADERS)
        except (ValueError, ExcelDependencyError) as error:
            return Response({"detail": str(error), "errors": []}, status=status.HTTP_400_BAD_REQUEST)
        try:
            create_client_types = parse_bool(
                request.data.get("create_missing_client_types"), default=False
            )
            create_price_levels = parse_bool(
                request.data.get("create_missing_price_levels"), default=False
            )
        except ValueError as error:
            return Response({"detail": str(error), "errors": []}, status=status.HTTP_400_BAD_REQUEST)

        missing_client_types, missing_price_levels = _missing_references(rows)
        if (
            create_client_types
            and missing_client_types
            and not HasRoleModelPermission._has_permission(
                request.user, "clients.add_clienttype"
            )
        ):
            return Response(
                {"detail": "No tienes permiso para crear tipos de cliente."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if (
            create_price_levels
            and missing_price_levels
            and not HasRoleModelPermission._has_permission(
                request.user, "products.add_pricelevel"
            )
        ):
            return Response(
                {"detail": "No tienes permiso para crear niveles de precio."},
                status=status.HTTP_403_FORBIDDEN,
            )

        created_client_types = []
        created_price_levels = []
        try:
            with transaction.atomic():
                if create_client_types:
                    created_client_types = _ensure_client_types(missing_client_types)
                if create_price_levels:
                    created_price_levels = _ensure_price_levels(missing_price_levels)

                client_type_lookup = {
                    item.name.casefold(): item.name
                    for item in ClientType.objects.filter(is_active=True)
                }
                price_level_lookup = {}
                for level in PriceLevel.objects.filter(is_active=True):
                    price_level_lookup[level.name.casefold()] = level
                    price_level_lookup[level.code.casefold()] = level

                errors = []
                valid = []
                seen = set()
                existing_tax_ids = {
                    value.casefold()
                    for value in Client.objects.values_list("tax_id", flat=True)
                }
                for row_number, row in enumerate(rows, start=2):
                    normalized, row_errors = _validate_client_row(
                        row,
                        row_number,
                        seen,
                        client_type_lookup,
                        price_level_lookup,
                    )
                    errors.extend(row_errors)
                    if not row_errors:
                        normalized_tax_id = normalized["tax_id"].casefold()
                        seen.add(normalized_tax_id)
                        if normalized_tax_id in existing_tax_ids:
                            errors.append(
                                _error(
                                    row_number,
                                    "NIT/CI",
                                    normalized["tax_id"],
                                    "Ya existe un cliente con este NIT/CI.",
                                )
                            )
                        else:
                            valid.append(normalized)
                if mode == "total" and errors:
                    valid = []

                created = 0
                if valid:
                    Client.objects.bulk_create([Client(**item) for item in valid])
                    created = len(valid)
        except IntegrityError:
            return Response(
                {
                    "detail": "No se pudo guardar la importación por un registro duplicado.",
                    "created": 0,
                    "errors": [],
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(
            {
                "mode": mode,
                "created": created,
                "rejected": len(errors),
                "errors": errors,
                "created_client_types": created_client_types,
                "created_price_levels": created_price_levels,
            }
        )


class ClientReportView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "clients.add_client"
    parser_classes = [JSONParser]

    def post(self, request):
        errors = request.data.get("errors", [])
        if not isinstance(errors, list):
            return Response({"detail": "El reporte no tiene un formato válido."}, status=status.HTTP_400_BAD_REQUEST)
        content, content_type = write_error_report(errors, "xlsx")
        response = HttpResponse(content, content_type=content_type)
        response["Content-Disposition"] = 'attachment; filename="observaciones_clientes.xlsx"'
        return response


def _validate_client_row(
    row,
    row_number,
    seen,
    client_type_lookup=None,
    price_level_lookup=None,
):
    errors = []
    values = {key: str(value or "").strip() for key, value in row.items()}
    required = {
        CLIENT_HEADERS[0]: ("name", 200),
        CLIENT_HEADERS[1]: ("tax_id", 30),
        CLIENT_HEADERS[2]: ("department", 80),
        CLIENT_HEADERS[3]: ("city_zone", 120),
        CLIENT_HEADERS[4]: ("whatsapp", 30),
        CLIENT_HEADERS[5]: ("client_type", 80),
        CLIENT_HEADERS[7]: ("business_activity", 200),
    }
    for column, (field, max_length) in required.items():
        value = values[column]
        if not value:
            errors.append(_error(row_number, column, value, "El campo es obligatorio."))
        elif len(value) > max_length:
            errors.append(_error(row_number, column, value, f"No puede superar {max_length} caracteres."))
        elif any(ord(char) < 32 for char in value):
            errors.append(_error(row_number, column, value, "Contiene caracteres no permitidos."))
    tax_id = values[CLIENT_HEADERS[1]]
    if tax_id and not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9./-]*", tax_id):
        errors.append(_error(row_number, CLIENT_HEADERS[1], tax_id, "Solo permite letras, números, punto, guion y barra."))
    if tax_id.casefold() in seen:
        errors.append(_error(row_number, CLIENT_HEADERS[1], tax_id, "Está repetido dentro del archivo."))
    client_type = values[CLIENT_HEADERS[5]]
    client_type_lookup = client_type_lookup or {
        name.casefold(): name for name in client_type_names()
    }
    canonical_client_type = client_type_lookup.get(client_type.casefold())
    if client_type and not canonical_client_type:
        errors.append(_error(row_number, CLIENT_HEADERS[5], client_type, "El valor no está permitido."))
    elif canonical_client_type:
        client_type = canonical_client_type
    price_value = values[CLIENT_HEADERS[6]]
    if price_level_lookup is None:
        price_level = PriceLevel.objects.filter(
            Q(code__iexact=price_value) | Q(name__iexact=price_value),
            is_active=True,
        ).first()
    else:
        price_level = price_level_lookup.get(price_value.casefold())
    if not price_level:
        errors.append(_error(row_number, CLIENT_HEADERS[6], price_value, "No existe un nivel de precio activo con ese nombre o código."))
    normalized = {
        "name": values[CLIENT_HEADERS[0]],
        "tax_id": tax_id,
        "department": values[CLIENT_HEADERS[2]],
        "city_zone": values[CLIENT_HEADERS[3]],
        "whatsapp": values[CLIENT_HEADERS[4]],
        "client_type": client_type,
        "price_level": price_level,
        "business_activity": values[CLIENT_HEADERS[7]],
        "observations": values[CLIENT_HEADERS[8]],
        "is_active": True,
    }
    return normalized, errors


def _missing_references(rows):
    existing_client_types = {
        name.casefold()
        for name in ClientType.objects.filter(is_active=True).values_list("name", flat=True)
    }
    existing_price_levels = set()
    for name, code in PriceLevel.objects.filter(is_active=True).values_list("name", "code"):
        existing_price_levels.update((name.casefold(), code.casefold()))

    client_types = {}
    price_levels = {}
    for row in rows:
        client_type = str(row.get(CLIENT_HEADERS[5]) or "").strip()
        if 0 < len(client_type) <= 80 and client_type.casefold() not in existing_client_types:
            client_types.setdefault(client_type.casefold(), client_type)
        price_level = str(row.get(CLIENT_HEADERS[6]) or "").strip()
        if 0 < len(price_level) <= 100 and price_level.casefold() not in existing_price_levels:
            price_levels.setdefault(price_level.casefold(), price_level)
    return list(client_types.values()), list(price_levels.values())


def _ensure_client_types(names):
    created = []
    for name in names:
        item = ClientType.objects.filter(name__iexact=name).first()
        if item:
            if not item.is_active:
                item.is_active = True
                item.save(update_fields=["is_active"])
                created.append(item.name)
            continue
        ClientType.objects.create(name=name)
        created.append(name)
    return created


def _ensure_price_levels(names):
    created = []
    for name in names:
        item = PriceLevel.objects.filter(Q(name__iexact=name) | Q(code__iexact=name)).first()
        if item:
            if not item.is_active:
                item.is_active = True
                item.save(update_fields=["is_active"])
                created.append(item.name)
            continue
        PriceLevel.objects.create(
            name=name,
            code=_unique_price_level_code(name),
            description="Creado durante la importación de clientes.",
        )
        created.append(name)
    return created


def _unique_price_level_code(name):
    normalized = unicodedata.normalize("NFKD", name)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    base = re.sub(r"[^A-Za-z0-9]+", "_", ascii_name).strip("_").upper()
    base = (base or "NIVEL")[:40]
    candidate = base
    suffix = 2
    while PriceLevel.objects.filter(code__iexact=candidate).exists():
        ending = f"_{suffix}"
        candidate = f"{base[:40 - len(ending)]}{ending}"
        suffix += 1
    return candidate


def _filter_clients(queryset, request):
    search = request.query_params.get("search", "").strip()
    if search:
        queryset = queryset.filter(Q(name__icontains=search) | Q(tax_id__icontains=search) | Q(department__icontains=search) | Q(city_zone__icontains=search))
    for field in ("department", "city_zone", "client_type"):
        value = request.query_params.get(field)
        if value:
            queryset = queryset.filter(**{f"{field}__iexact": value})
    if request.query_params.get("is_active") in {"true", "false"}:
        queryset = queryset.filter(is_active=request.query_params.get("is_active") == "true")
    return queryset


def _error(row, column, value, reason):
    return {"fila": row, "columna": column, "valor": value, "motivo": reason}


def _excel_response(headers, rows, basename, instructions):
    try:
        content, content_type = write_workbook(headers, rows, file_format="xlsx", instructions=instructions, sheet_name="Clientes")
    except (ValueError, ExcelDependencyError) as error:
        return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
    response = HttpResponse(content, content_type=content_type)
    response["Content-Disposition"] = f'attachment; filename="{basename}.xlsx"'
    return response
