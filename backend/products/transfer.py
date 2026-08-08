import re
import unicodedata
from decimal import Decimal, InvalidOperation
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from idesem.excel import ExcelDependencyError, parse_bool, read_rows, write_error_report, write_workbook
from users.permissions import HasRoleModelPermission
from .models import Category, Product

NORMAL_PRICE_HEADER = "Precio de venta normal (nivel x1) (Bs)"
PRODUCT_HEADERS = ["SKU", "Nombre", "Categor\u00eda", "C\u00f3digo de barras", "Descripci\u00f3n", NORMAL_PRICE_HEADER, "Activo", "Almac\u00e9n", "Cantidad"]
PRODUCT_INSTRUCTIONS = [("SKU", "Obligatorio, único, máximo 80 caracteres."), ("Nombre", "Obligatorio, máximo 200 caracteres."), ("Categoría", "Debe coincidir con una categoría activa."), ("Código de barras", "Opcional, único, máximo 100 caracteres."), ("Descripción", "Opcional, máximo 5000 caracteres."), (NORMAL_PRICE_HEADER, "Obligatorio. Número mayor o igual a 0, con máximo dos decimales."), ("Activo", "Opcional. Usa SI/NO, TRUE/FALSE o 1/0."), ("Almacén", "Opcional. Código o nombre de almacén activo."), ("Cantidad", "Opcional. Entero mayor que 0 cuando se indica almacén. Luego puede aumentar o disminuir mediante movimientos.")]

class ProductTemplateView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "products.view_product"
    def get(self, request): return _excel_response(PRODUCT_HEADERS, [], "Plantilla_Productos", PRODUCT_INSTRUCTIONS)

class ProductExportView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "products.view_product"
    def get(self, request):
        qs = Product.objects.select_related("category").prefetch_related("stocks__warehouse").filter(deleted_at__isnull=True)
        qs = _filter_products(qs, request)
        rows = []
        for item in qs:
            stock = next(iter(item.stocks.all()), None)
            rows.append({PRODUCT_HEADERS[0]: item.sku, PRODUCT_HEADERS[1]: item.name, PRODUCT_HEADERS[2]: item.category.code, PRODUCT_HEADERS[3]: item.barcode or "", PRODUCT_HEADERS[4]: item.description, PRODUCT_HEADERS[5]: item.normal_unit_price, PRODUCT_HEADERS[6]: "SI" if item.is_active else "NO", PRODUCT_HEADERS[7]: stock.warehouse.code if stock else "", PRODUCT_HEADERS[8]: stock.quantity if stock else ""})
        return _excel_response(PRODUCT_HEADERS, rows, "Productos", PRODUCT_INSTRUCTIONS)

class ProductImportView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "products.add_product"
    parser_classes = [MultiPartParser, FormParser]
    def post(self, request):
        upload = request.FILES.get("file"); mode = request.data.get("mode", "partial")
        if not upload: return Response({"detail": "Selecciona un archivo Excel.", "errors": []}, status=400)
        if mode not in {"partial", "total"}: return Response({"detail": "El modo debe ser partial o total.", "errors": []}, status=400)
        try:
            rows = read_rows(upload, PRODUCT_HEADERS)
        except (ValueError, ExcelDependencyError) as error:
            return Response({"detail": str(error), "errors": []}, status=400)
        try:
            create_categories = parse_bool(
                request.data.get("create_missing_categories"), default=False
            )
        except ValueError as error:
            return Response({"detail": str(error), "errors": []}, status=400)
        missing_categories = _missing_categories(rows)
        if (
            create_categories
            and missing_categories
            and not HasRoleModelPermission._has_permission(
                request.user, "products.add_category"
            )
        ):
            return Response(
                {"detail": "No tienes permiso para crear categorías."},
                status=status.HTTP_403_FORBIDDEN,
            )
        created_categories = []
        if create_categories:
            try:
                with transaction.atomic():
                    created_categories = _ensure_categories(missing_categories)
            except IntegrityError:
                return Response(
                    {"detail": "No se pudieron crear las categorías del archivo.", "errors": []},
                    status=status.HTTP_409_CONFLICT,
                )
        errors=[]; valid=[]; seen=set(); seen_barcodes=set()
        for number,row in enumerate(rows,start=2):
            normalized,row_errors=_validate_product_row(row,number,seen)
            errors.extend(row_errors)
            if not row_errors:
                seen.add(normalized["sku"])
                duplicate = Product.objects.filter(sku__iexact=normalized["sku"]).exists() or (normalized["barcode"] and Product.objects.filter(barcode=normalized["barcode"]).exists()) or (normalized["barcode"] and normalized["barcode"] in seen_barcodes)
                if duplicate: errors.append(_error(number,"SKU",normalized["sku"],"El SKU o código de barras ya existe o está repetido."))
                else:
                    valid.append(normalized)
                    if normalized["barcode"]: seen_barcodes.add(normalized["barcode"])
        if mode == "total" and errors: valid=[]
        created=0
        if valid:
            try:
                from inventory.models import Stock
                with transaction.atomic():
                    products=Product.objects.bulk_create([Product(**{k:v for k,v in item.items() if k not in {"warehouse","default_quantity"}},created_by=request.user,updated_by=request.user) for item in valid])
                    stocks=[Stock(product=product,warehouse=item["warehouse"],quantity=item["default_quantity"] or 0) for product,item in zip(products,valid) if item["warehouse"]]
                    if stocks: Stock.objects.bulk_create(stocks)
                    created=len(products)
            except IntegrityError: return Response({"detail":"No se pudo guardar por un registro duplicado.","created":0,"rejected":len(errors),"errors":errors},status=409)
        return Response({"mode":mode,"created":created,"rejected":len(errors),"errors":errors,"created_categories":created_categories})

class ProductReportView(APIView):
    permission_classes = [HasRoleModelPermission]
    required_permission = "products.add_product"
    parser_classes = [JSONParser]
    def post(self,request):
        content,content_type=write_error_report(request.data.get("errors",[]),"xlsx"); response=HttpResponse(content,content_type=content_type); response["Content-Disposition"]='attachment; filename="observaciones_productos.xlsx"'; return response

def _validate_product_row(row,number,seen):
    from inventory.models import Warehouse
    v={k:str(value or "").strip() for k,value in row.items()}; errors=[]
    for col,limit in [("SKU",80),("Nombre",200)]:
        if not v[col]: errors.append(_error(number,col,v[col],"El campo es obligatorio."))
        elif len(v[col])>limit: errors.append(_error(number,col,v[col],f"No puede superar {limit} caracteres."))
    sku=v["SKU"].upper()
    if sku and not re.fullmatch(r"[A-Z0-9._/-]+",sku): errors.append(_error(number,"SKU",sku,"El formato del SKU no es válido."))
    if sku in seen: errors.append(_error(number,"SKU",sku,"Está repetido dentro del archivo."))
    category=Category.objects.filter(Q(code__iexact=v["Categor\u00eda"])|Q(name__iexact=v["Categor\u00eda"]),is_active=True).first()
    if not category: errors.append(_error(number,"Categoría",v["Categor\u00eda"],"No existe una categoría activa."))
    barcode=v["C\u00f3digo de barras"] or None
    if barcode and len(barcode)>100: errors.append(_error(number,"Código de barras",barcode,"No puede superar 100 caracteres."))
    normal_price_value = v[NORMAL_PRICE_HEADER]
    normal_price = None
    if not normal_price_value:
        errors.append(_error(number, NORMAL_PRICE_HEADER, normal_price_value, "El campo es obligatorio."))
    else:
        try:
            normal_price = Decimal(normal_price_value.replace(",", "."))
            if not normal_price.is_finite() or normal_price < 0:
                raise InvalidOperation
            if normal_price.as_tuple().exponent < -2:
                errors.append(_error(number, NORMAL_PRICE_HEADER, normal_price_value, "Usa máximo dos decimales."))
            if normal_price > Decimal("9999999999.99"):
                errors.append(_error(number, NORMAL_PRICE_HEADER, normal_price_value, "El precio es demasiado grande."))
        except (InvalidOperation, ValueError):
            normal_price = None
            errors.append(_error(number, NORMAL_PRICE_HEADER, normal_price_value, "Usa un número válido mayor o igual a 0."))
    try: active=parse_bool(v["Activo"],True)
    except ValueError as error: errors.append(_error(number,"Activo",v["Activo"],str(error))); active=True
    warehouse=None; quantity=None
    if v.get("Almac\u00e9n"):
        warehouse=Warehouse.objects.filter(Q(code__iexact=v["Almac\u00e9n"])|Q(name__iexact=v["Almac\u00e9n"]),is_active=True).first()
        if not warehouse: errors.append(_error(number,"Almacén",v["Almac\u00e9n"],"No existe un almacén activo."))
        if not v.get("Cantidad"): errors.append(_error(number,"Cantidad","","Es obligatoria cuando se indica almacén."))
    if v.get("Cantidad"):
        try: quantity=int(v["Cantidad"]); assert quantity>0
        except (ValueError,AssertionError): errors.append(_error(number,"Cantidad",v["Cantidad"],"Debe ser un número entero mayor que 0."))
    return {"category":category,"name":v["Nombre"],"sku":sku,"barcode":barcode,"description":v["Descripci\u00f3n"],"normal_unit_price":normal_price,"is_active":active,"warehouse":warehouse,"default_quantity":quantity},errors

def _missing_categories(rows):
    existing = set()
    for name, code in Category.objects.filter(is_active=True).values_list("name", "code"):
        existing.update((name.casefold(), code.casefold()))
    missing = {}
    for row in rows:
        value = str(row.get("Categoría") or "").strip()
        if 0 < len(value) <= 120 and value.casefold() not in existing:
            missing.setdefault(value.casefold(), value)
    return list(missing.values())

def _ensure_categories(names):
    created = []
    for name in names:
        category = Category.objects.filter(Q(name__iexact=name) | Q(code__iexact=name)).first()
        if category:
            if not category.is_active:
                category.is_active = True
                category.save(update_fields=["is_active"])
                created.append(category.name)
            continue
        Category.objects.create(
            name=name,
            code=_unique_category_code(name),
            description="Creada durante la importación de productos.",
        )
        created.append(name)
    return created

def _unique_category_code(name):
    normalized = unicodedata.normalize("NFKD", name)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    base = re.sub(r"[^A-Za-z0-9]+", "_", ascii_name).strip("_").upper()
    base = (base or "CATEGORIA")[:40]
    candidate = base
    suffix = 2
    while Category.objects.filter(code__iexact=candidate).exists():
        ending = f"_{suffix}"
        candidate = f"{base[:40 - len(ending)]}{ending}"
        suffix += 1
    return candidate

def _filter_products(qs,request):
    search=request.query_params.get("search","").strip()
    if search: qs=qs.filter(Q(name__icontains=search)|Q(sku__icontains=search)|Q(barcode__icontains=search))
    if request.query_params.get("category"): qs=qs.filter(category_id=request.query_params["category"])
    return qs
def _error(row,column,value,reason): return {"fila":row,"columna":column,"valor":value,"motivo":reason}
def _excel_response(headers,rows,basename,instructions):
    content,content_type=write_workbook(headers,rows,file_format="xlsx",instructions=instructions,sheet_name="Productos"); response=HttpResponse(content,content_type=content_type); response["Content-Disposition"]=f'attachment; filename="{basename}.xlsx"'; return response
