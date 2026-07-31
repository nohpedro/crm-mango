import re

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

from idesem.excel import ExcelDependencyError, parse_bool, read_rows, write_error_report, write_workbook
from products.models import PriceLevel
from users.permissions import HasRoleModelPermission

from .filters import ClientFilter
from .models import Client, ClientType
from .serializers import ClientReadSerializer, ClientTypeSerializer, ClientWriteSerializer

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
        return [HasRoleModelPermission()]

    def get_serializer_class(self):
        return ClientWriteSerializer if self.action in {"create", "update", "partial_update"} else ClientReadSerializer


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
        errors = []
        valid = []
        seen = set()
        for row_number, row in enumerate(rows, start=2):
            normalized, row_errors = _validate_client_row(row, row_number, seen)
            errors.extend(row_errors)
            if not row_errors:
                seen.add(normalized["tax_id"])
                if Client.objects.filter(tax_id__iexact=normalized["tax_id"]).exists():
                    errors.append(_error(row_number, "NIT/CI", normalized["tax_id"], "Ya existe un cliente con este NIT/CI."))
                else:
                    valid.append(normalized)
        if mode == "total" and errors:
            valid = []
        created = 0
        if valid:
            try:
                with transaction.atomic():
                    Client.objects.bulk_create([Client(**item) for item in valid])
                    created = len(valid)
            except IntegrityError:
                return Response({"detail": "No se pudo guardar la importación por un registro duplicado.", "created": 0, "errors": errors}, status=status.HTTP_409_CONFLICT)
        return Response({"mode": mode, "created": created, "rejected": len(errors), "errors": errors})


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


def _validate_client_row(row, row_number, seen):
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
    if tax_id in seen:
        errors.append(_error(row_number, CLIENT_HEADERS[1], tax_id, "Está repetido dentro del archivo."))
    client_type = values[CLIENT_HEADERS[5]]
    if client_type and client_type not in client_type_names():
        errors.append(_error(row_number, CLIENT_HEADERS[5], client_type, "El valor no está permitido."))
    price_value = values[CLIENT_HEADERS[6]]
    price_level = PriceLevel.objects.filter(Q(code__iexact=price_value) | Q(name__iexact=price_value), is_active=True).first()
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
