"""Excel transfer: one equipment unit per row, atomic quotation groups."""
from collections import defaultdict
from datetime import datetime

from django.db import IntegrityError, transaction
from django.http import HttpResponse
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from clients.models import Client
from products.models import Product
from idesem.excel import ExcelDependencyError, read_rows, write_error_report, write_workbook
from users.permissions import HasRoleModelPermission
from .models import Quotation
from .serializers import QuotationSerializer
from .views import QuotationViewSet

HEADERS = [
    "Codigo Cotización", "NIT/CI", "Nombre_cliente", "Fecha_cotizacion",
    "SKU", "Producto", "Numero_serie", "Precio_unitario_Bs", "Estado", "Observaciones",
]
INSTRUCTIONS = [
    ("Formato", "Una fila por unidad. Usa la plantilla adaptada, no la plantilla original de equipos."),
    ("Codigo Cotización", "Obligatorio, máximo 100 caracteres. Repite el código para agrupar equipos. No se actualizan cotizaciones existentes."),
    ("NIT/CI", "Obligatorio. NIT/CI de un cliente activo existente, conservando ceros iniciales. Sustituye Codigo_cliente."),
    ("Nombre_cliente", "Obligatorio en cada fila. Debe coincidir con el cliente identificado por NIT/CI."),
    ("Fecha_cotizacion", "Obligatoria: AAAA-MM-DD o DD/MM/AAAA. Sustituye Fecha_compra."),
    ("SKU", "Obligatorio. Código de un producto activo del catálogo. Sustituye los datos descriptivos del aparato."),
    ("Producto", "Descripción de referencia; no modifica el catálogo."),
    ("Numero_serie", "Obligatorio solo para Pagada, una serie por fila, máximo 120 caracteres. No repetir dentro de la cotización."),
    ("Precio_unitario_Bs", "Opcional. Vacío: precio calculado por el sistema. Un importe explícito requiere permiso para editar precios."),
    ("Estado", "Pendiente (predeterminado) o Pagada. Pagada requiere permiso para cambiar estado o editar cotizaciones."),
    ("Observaciones", "Opcionales. Repite las mismas observaciones en todas las filas de la cotización."),
    ("Agrupación", "Todas las filas de un código deben tener el mismo cliente, fecha, estado y observaciones. Un error rechaza el grupo completo."),
    ("Duplicados", "Los códigos se comparan sin distinguir mayúsculas. Para corregir una cotización rechazada, vuelve a cargar todas sus filas."),
]


def excel_response(rows, filename):
    content, content_type = write_workbook(HEADERS, rows, instructions=INSTRUCTIONS, sheet_name="Cotizaciones")
    response = HttpResponse(content, content_type=content_type)
    response["Content-Disposition"] = f'attachment; filename="{filename}.xlsx"'
    return response


def error(row, column, value, reason):
    return {"fila": row, "columna": column, "valor": str(value), "motivo": str(reason)}


class QuotationTransferTemplateView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_any_permissions = ("quotations.import_quotation", "quotations.export_quotation")

    def get(self, request):
        return excel_response([], "Plantilla_Cotizaciones")


class QuotationExportView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "quotations.export_quotation"

    def get(self, request):
        view = QuotationViewSet()
        view.request = request
        queryset = view.filter_queryset(view.get_queryset())
        rows = []
        for quotation in queryset:
            for item in quotation.items.all():
                for index in range(item.quantity):
                    values = [
                        quotation.import_reference or quotation.number,
                        quotation.client_tax_id, quotation.client_name,
                        quotation.quotation_date.isoformat(), item.sku, item.name,
                        item.serial_numbers[index] if index < len(item.serial_numbers) else "",
                        item.unit_price, quotation.get_status_display(), quotation.notes,
                    ]
                    rows.append(dict(zip(HEADERS, values)))
        return excel_response(rows, "Cotizaciones")


class QuotationImportView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "quotations.import_quotation"
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        upload = request.FILES.get("file")
        mode = request.data.get("mode", "partial")
        if not upload or mode not in {"partial", "total"}:
            return Response({"detail": "Selecciona un archivo y un modo partial o total."}, status=400)
        if upload.size > 15 * 1024 * 1024:
            return Response({"detail": "El archivo no puede superar los 15 MB."}, status=400)
        try:
            rows = read_rows(upload, HEADERS, date_headers=("Fecha_cotizacion",))
        except (ValueError, ExcelDependencyError) as exc:
            return Response({"detail": str(exc)}, status=400)
        groups = defaultdict(list)
        errors = []
        invalid_rows = 0
        for number, row in enumerate(rows, 2):
            if not any(row.values()):
                continue
            reference = row[HEADERS[0]].strip().casefold()
            if not reference or len(reference) > 100:
                errors.append(error(number, HEADERS[0], reference, "Indica un código de hasta 100 caracteres."))
                invalid_rows += 1
            else:
                groups[reference].append((number, row))
        if not groups and not errors:
            return Response({"detail": "El archivo no contiene equipos para importar."}, status=400)
        valid = []
        rejected = invalid_rows
        for reference, entries in groups.items():
            serializer, group_errors = validate_group(reference, entries, request)
            errors.extend(group_errors)
            if group_errors:
                rejected += 1
            else:
                valid.append((reference, entries, serializer))
        created = 0
        try:
            with transaction.atomic():
                if mode != "total" or not errors:
                    for reference, entries, serializer in valid:
                        try:
                            with transaction.atomic():
                                serializer.save(created_by=request.user, import_reference=reference)
                            created += 1
                        except IntegrityError:
                            if mode == "total":
                                raise
                            rejected += 1
                            errors.append(error(entries[0][0], HEADERS[0], reference, "El código ya fue importado por otro proceso."))
        except IntegrityError:
            return Response({"detail": "Conflicto de datos. No se guardó ninguna cotización; revisa los códigos y reintenta.", "created": 0}, status=409)
        if mode == "total" and errors:
            rejected = len(groups) + invalid_rows
        return Response({"mode": mode, "created": created, "rejected": rejected, "errors": errors})


def validate_group(reference, entries, request):
    errors = []
    first_number, first = entries[0]
    if Quotation.objects.filter(import_reference__iexact=reference).exists() or Quotation.objects.filter(number__iexact=reference).exists():
        errors.append(error(first_number, HEADERS[0], reference, "Ya existe una cotización con este código."))
    customers = list(Client.objects.filter(tax_id__iexact=first["NIT/CI"], is_active=True)[:2])
    customer = customers[0] if len(customers) == 1 else None
    if not customer:
        errors.append(error(first_number, "NIT/CI", first["NIT/CI"], "No identifica un único cliente activo."))
    state = first["Estado"].casefold() or "pendiente"
    state = {"pendiente": "pending", "pagada": "paid"}.get(state, state)
    if state == "paid" and not any(HasRoleModelPermission._has_permission(request.user, code) for code in ("quotations.change_quotation_status", "quotations.change_quotation")):
        errors.append(error(first_number, "Estado", first["Estado"], "No tienes permiso para importar cotizaciones pagadas."))
    date = first["Fecha_cotizacion"]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            date = datetime.strptime(date, fmt).date().isoformat()
            break
        except ValueError:
            continue
    items = []
    serials = set()
    for number, row in entries:
        for column in ("NIT/CI", "Fecha_cotizacion", "Estado", "Observaciones"):
            if row[column] != first[column]:
                errors.append(error(number, column, row[column], "Debe coincidir en todas las filas de la cotización."))
        if not row["Nombre_cliente"]:
            errors.append(error(number, "Nombre_cliente", "", "El nombre del cliente es obligatorio."))
        elif customer and row["Nombre_cliente"].casefold() != customer.name.casefold():
            errors.append(error(number, "Nombre_cliente", row["Nombre_cliente"], "No coincide con el NIT/CI indicado."))
        products = list(Product.objects.filter(sku__iexact=row["SKU"], is_active=True, deleted_at__isnull=True)[:2])
        product = products[0] if len(products) == 1 else None
        if not product:
            errors.append(error(number, "SKU", row["SKU"], "No identifica un único producto activo."))
        serial = row["Numero_serie"]
        if serial and serial.casefold() in serials:
            errors.append(error(number, "Numero_serie", serial, "Serie repetida dentro de la cotización."))
        serials.add(serial.casefold())
        item = {"product": product.pk if product else None, "quantity": 1, "serial_numbers": [serial] if serial else []}
        if row["Precio_unitario_Bs"]:
            item["manual_unit_price"] = row["Precio_unitario_Bs"]
        items.append(item)
    serializer = QuotationSerializer(data={
        "client": customer.pk if customer else None,
        "client_name": customer.name if customer else "",
        "client_tax_id": customer.tax_id if customer else "",
        "client_phone": customer.whatsapp if customer else "",
        "client_address": f"{customer.city_zone}, {customer.department}" if customer else "",
        "quotation_date": date, "status": state, "notes": first["Observaciones"], "items": items,
    }, context={"request": request})
    if not serializer.is_valid():
        columns = {"quotation_date": "Fecha_cotizacion", "status": "Estado", "serial_numbers": "Numero_serie", "manual_unit_price": "Precio_unitario_Bs", "product": "SKU"}
        for field, messages in serializer.errors.items():
            if field == "items" and isinstance(messages, list) and messages and isinstance(messages[0], dict):
                for (number, row), messages_by_field in zip(entries, messages):
                    for key, reasons in messages_by_field.items():
                        column = columns.get(key, key)
                        errors.append(error(number, column, row.get(column, ""), reasons))
            else:
                errors.append(error(first_number, columns.get(field, field), "", messages))
    return serializer, errors


class QuotationTransferReportView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "quotations.import_quotation"

    def post(self, request):
        errors = request.data.get("errors", [])
        if not isinstance(errors, list) or any(not isinstance(item, dict) for item in errors):
            return Response({"detail": "El reporte no tiene un formato válido."}, status=400)
        content, content_type = write_error_report(errors)
        response = HttpResponse(content, content_type=content_type)
        response["Content-Disposition"] = 'attachment; filename="Observaciones_Cotizaciones.xlsx"'
        return response
