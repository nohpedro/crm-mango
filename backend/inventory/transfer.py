import re

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from idesem.excel import ExcelDependencyError, parse_bool, read_rows, write_error_report, write_workbook
from products.models import Product
from users.permissions import HasRoleModelPermission

from .models import Stock, Warehouse

WAREHOUSE_HEADERS = ["Nombre", "Código", "Descripción", "Dirección", "Activo"]
STOCK_HEADERS = ["SKU", "Almacén", "Cantidad", "Stock mínimo"]

class WarehouseTemplateView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "inventory.view_warehouse"
    def get(self, request): return _excel_response(WAREHOUSE_HEADERS, [], "Plantilla_Almacenes", "Almacenes")

class WarehouseExportView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "inventory.view_warehouse"
    def get(self, request):
        qs = Warehouse.objects.all()
        search = request.query_params.get("search", "").strip()
        if search: qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search) | Q(address__icontains=search))
        rows = [{WAREHOUSE_HEADERS[0]: w.name, WAREHOUSE_HEADERS[1]: w.code, WAREHOUSE_HEADERS[2]: w.description, WAREHOUSE_HEADERS[3]: w.address, WAREHOUSE_HEADERS[4]: "SI" if w.is_active else "NO"} for w in qs]
        return _excel_response(WAREHOUSE_HEADERS, rows, "Almacenes", "Almacenes")

class WarehouseImportView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "inventory.add_warehouse"
    parser_classes = [MultiPartParser, FormParser]
    def post(self, request):
        return _import(request, "warehouses")

class StockTemplateView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "inventory.view_stock"
    def get(self, request): return _excel_response(STOCK_HEADERS, [], "Plantilla_Existencias", "Existencias")

class StockExportView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "inventory.view_stock"
    def get(self, request):
        qs = Stock.objects.select_related("product", "warehouse").all()
        rows = [{STOCK_HEADERS[0]: s.product.sku, STOCK_HEADERS[1]: s.warehouse.code, STOCK_HEADERS[2]: s.quantity, STOCK_HEADERS[3]: s.minimum_stock} for s in qs]
        return _excel_response(STOCK_HEADERS, rows, "Existencias", "Existencias")

class StockImportView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "inventory.add_stock"
    parser_classes = [MultiPartParser, FormParser]
    def post(self, request): return _import(request, "stocks")

class InventoryReportView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "inventory.add_stock"
    parser_classes = [JSONParser]
    def post(self, request):
        resource = request.query_params.get("resource", "stocks")
        content, content_type = write_error_report(request.data.get("errors", []), "xlsx")
        response = HttpResponse(content, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="observaciones_{resource}.xlsx"'
        return response

def _import(request, resource):
    upload = request.FILES.get("file"); mode = request.data.get("mode", "partial")
    if not upload: return Response({"detail": "Selecciona un archivo Excel.", "errors": []}, status=400)
    if mode not in {"partial", "total"}: return Response({"detail": "El modo debe ser partial o total."}, status=400)
    headers = WAREHOUSE_HEADERS if resource == "warehouses" else STOCK_HEADERS
    try: rows = read_rows(upload, headers)
    except (ValueError, ExcelDependencyError) as error: return Response({"detail": str(error), "errors": []}, status=400)
    errors = []; valid = []; seen = set()
    for row_number, row in enumerate(rows, start=2):
        normalized, row_errors = _validate_warehouse(row, row_number, seen) if resource == "warehouses" else _validate_stock(row, row_number, seen)
        errors.extend(row_errors)
        if not row_errors: seen.add(normalized["key"]); valid.append(normalized)
    if mode == "total" and errors: valid = []
    created = 0
    if valid:
        try:
            with transaction.atomic():
                if resource == "warehouses": Warehouse.objects.bulk_create([Warehouse(**{k:v for k,v in item.items() if k != "key"}) for item in valid])
                else: Stock.objects.bulk_create([Stock(**{k:v for k,v in item.items() if k != "key"}) for item in valid])
                created = len(valid)
        except IntegrityError: return Response({"detail": "No se pudo guardar por un registro duplicado.", "created": 0, "rejected": len(errors), "errors": errors}, status=409)
    return Response({"mode": mode, "created": created, "rejected": len(errors), "errors": errors})

def _validate_warehouse(row, number, seen):
    values = {k: str(v or "").strip() for k,v in row.items()}; errors = []
    for col, field, limit in [("Nombre", "name", 150), ("Código", "code", 40)]:
        if not values[col]: errors.append(_error(number, col, values[col], "El campo es obligatorio."))
        elif len(values[col]) > limit: errors.append(_error(number, col, values[col], f"No puede superar {limit} caracteres."))
    code = values["Código"].upper(); key = code
    if code in seen: errors.append(_error(number, "Código", code, "Está repetido dentro del archivo."))
    if Warehouse.objects.filter(code__iexact=code).exists(): errors.append(_error(number, "Código", code, "Ya existe un almacén con este código."))
    try: active = parse_bool(values["Activo"], True)
    except ValueError as error: errors.append(_error(number, "Activo", values["Activo"], str(error))); active = True
    return {"name": values["Nombre"], "code": code, "description": values["Descripción"], "address": values["Dirección"], "is_active": active, "key": key}, errors

def _validate_stock(row, number, seen):
    values = {k: str(v or "").strip() for k,v in row.items()}; errors = []
    sku = values["SKU"].upper(); warehouse_code = values["Almacén"].upper(); product = Product.objects.filter(sku__iexact=sku, deleted_at__isnull=True).first(); warehouse = Warehouse.objects.filter(Q(code__iexact=warehouse_code) | Q(name__iexact=values["Almacén"]), is_active=True).first()
    if not product: errors.append(_error(number, "SKU", sku, "No existe un producto activo con ese SKU."))
    if not warehouse: errors.append(_error(number, "Almacén", values["Almacén"], "No existe un almacén activo con ese código o nombre."))
    try: quantity = int(values["Cantidad"]); minimum = int(values["Stock mínimo"] or 0)
    except ValueError: quantity = minimum = 0; errors.append(_error(number, "Cantidad", values["Cantidad"], "Usa un número entero válido."))
    if quantity < 0: errors.append(_error(number, "Cantidad", quantity, "No puede ser negativa."))
    if minimum < 0: errors.append(_error(number, "Stock mínimo", minimum, "No puede ser negativo."))
    key = f"{product.pk if product else sku}:{warehouse.pk if warehouse else warehouse_code}"
    if key in seen: errors.append(_error(number, "SKU", sku, "La combinación producto y almacén está repetida."))
    if product and warehouse and Stock.objects.filter(product=product, warehouse=warehouse).exists(): errors.append(_error(number, "Almacén", warehouse.code, "Ya existe esta vinculación de producto y almacén."))
    return {"product": product, "warehouse": warehouse, "quantity": quantity, "minimum_stock": minimum, "key": key}, errors

def _error(row, column, value, reason): return {"fila": row, "columna": column, "valor": value, "motivo": reason}
def _excel_response(headers, rows, basename, sheet):
    try: content, content_type = write_workbook(headers, rows, file_format="xlsx", sheet_name=sheet)
    except (ValueError, ExcelDependencyError) as error: return Response({"detail": str(error)}, status=400)
    response = HttpResponse(content, content_type=content_type); response["Content-Disposition"] = f'attachment; filename="{basename}.xlsx"'; return response
