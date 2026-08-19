from django.contrib.auth.models import Permission


RESOURCE_DEPENDENCIES = {
    "clients.clienttype": {"clients.view_client"},
    "products.category": {"products.view_product"},
    "products.pricelevel": {"products.view_product"},
    "products.pricetier": {"products.view_product"},
    "products.productprice": {"products.view_product"},
    "products.productimage": {"products.view_product"},
    "inventory.stock": {"products.view_product"},
    "inventory.stockmovement": {"inventory.view_stock"},
    "inventory.warehouse": {"inventory.view_stock"},
}

PERMISSION_DEPENDENCIES = {
    "quotations.add_quotation": {
        "quotations.view_quotation",
        "clients.view_client",
        "products.view_product",
    },
    "quotations.change_quotation": {
        "quotations.view_quotation",
        "clients.view_client",
        "products.view_product",
    },
    "quotations.change_quotation_status": {"quotations.view_quotation"},
    "quotations.change_quotation_item_price": {"quotations.change_quotation"},
}

RESOURCE_LABELS = {
    "client": "Clientes",
    "clienttype": "Tipos de cliente",
    "product": "Productos",
    "category": "Categorías",
    "pricelevel": "Tipos de precio",
    "pricetier": "Niveles por cantidad",
    "productprice": "Precios de productos",
    "productimage": "Imágenes de productos",
    "stock": "Existencias",
    "stockmovement": "Movimientos de inventario",
    "warehouse": "Almacenes",
    "quotation": "Cotizaciones",
    "user": "Usuarios",
    "role": "Roles y permisos",
}

ACTION_LABELS = {
    "add": "Crear",
    "change": "Editar",
    "delete": "Eliminar",
    "view": "Ver",
}

CUSTOM_ACTION_LABELS = {
    "change_quotation_status": "Cambiar estado de",
    "change_quotation_item_price": "Editar precios de",
    "configure_quotation_document": "Configurar documento de",
    "manage_quotation_templates": "Administrar plantillas de",
}


def permission_code(permission: Permission) -> str:
    return f"{permission.content_type.app_label}.{permission.codename}"


def dependencies_for(permission: Permission) -> set[str]:
    code = permission_code(permission)
    resource = f"{permission.content_type.app_label}.{permission.content_type.model}"
    dependencies = set(RESOURCE_DEPENDENCIES.get(resource, set()))
    dependencies.update(PERMISSION_DEPENDENCIES.get(code, set()))
    if permission.codename.startswith(("add_", "change_", "delete_")):
        dependencies.add(
            f"{permission.content_type.app_label}.view_{permission.content_type.model}"
        )
    dependencies.discard(code)
    return dependencies


def dependencies_for_code(code: str) -> set[str]:
    app_label, codename = code.split(".", maxsplit=1)
    permission = (
        Permission.objects.select_related("content_type")
        .filter(content_type__app_label=app_label, codename=codename)
        .first()
    )
    return dependencies_for(permission) if permission else set()


def missing_dependencies(permissions) -> set[str]:
    selected = {permission_code(permission) for permission in permissions}
    missing = set()
    for permission in permissions:
        missing.update(dependencies_for(permission) - selected)
    return missing


def effective_permission_codes(codes) -> set[str]:
    effective = set(codes)
    changed = True
    while changed:
        changed = False
        for code in tuple(effective):
            if not dependencies_for_code(code).issubset(effective):
                effective.remove(code)
                changed = True
    return effective


def permission_label(code: str) -> str:
    app_label, codename = code.split(".", maxsplit=1)
    permission = (
        Permission.objects.select_related("content_type")
        .filter(content_type__app_label=app_label, codename=codename)
        .first()
    )
    if not permission:
        return code
    action = CUSTOM_ACTION_LABELS.get(codename)
    if not action:
        action = ACTION_LABELS.get(codename.split("_", maxsplit=1)[0], "Usar")
    resource = RESOURCE_LABELS.get(
        permission.content_type.model,
        permission.content_type.model,
    )
    return f"{action} {resource}"
