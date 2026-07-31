from copy import deepcopy
from math import floor


COMPANY_NAME = "IDESEM S.R.L."
EDITOR_ROW_HEIGHT_MM = 1.5
EDITOR_GAP_SCALE = 0.3125
STANDARD_FRAME_HEIGHT_MM = 279 - 9 - 12 - (12 * 25.4 / 72)
STANDARD_HEADER_GAP_MM = 5


DEFAULT_TEMPLATE_SECTIONS = [
    {"key": "company", "title": "Información de la empresa", "visible": True, "order": 10, "content": "IDESEM S.R.L.\nSoluciones comerciales y técnicas"},
    {"key": "client", "title": "Información del cliente", "visible": True, "order": 20, "content": ""},
    {"key": "items", "title": "Detalle de productos", "visible": True, "order": 30, "content": ""},
    {"key": "totals", "title": "Totales", "visible": True, "order": 40, "content": "", "show_savings": True},
    {"key": "commercial_terms", "title": "Condiciones comerciales", "visible": True, "order": 50, "content": "Precios expresados en bolivianos. Disponibilidad sujeta a confirmación."},
    {"key": "validity", "title": "Vigencia de la cotización", "visible": True, "order": 60, "content": ""},
    {"key": "bank_details", "title": "Datos para el pago", "visible": True, "order": 70, "content": "Banco BNB    Cuenta: 1000301171    Titular: IDESEM S.R.L."},
    {"key": "contact", "title": "Contacto", "visible": True, "order": 80, "content": "IDESEM S.R.L. - Atención comercial"},
    {"key": "notes", "title": "Observaciones", "visible": True, "order": 90, "content": ""},
    {"key": "signature", "title": "Responsable", "visible": True, "order": 100, "content": "IDESEM S.R.L.\nGracias por su preferencia."},
]

DEFAULT_TEMPLATE_LAYOUT = {
    "page_width_mm": 210,
    "page_height_mm": 297,
    "roll_width_mm": 80,
    "roll_height_mm": 190,
    "box_padding_mm": 4,
    "header_image_id": None,
    "header_height_mm": 24,
    "header_image_width_mm": 43,
    "header_image_height_mm": 16,
    "header_company_font_size": 14,
    "header_subtitle_font_size": 8,
    "header_document_title": "COTIZACI\u00d3N",
    "header_document_title_font_size": 12,
    "columns": 12,
    "column_gap_mm": 1,
    "row_gap_mm": 1,
    "column_widths": [1] * 12,
}


def default_template_sections():
    return deepcopy(DEFAULT_TEMPLATE_SECTIONS)


def default_template_layout():
    return deepcopy(DEFAULT_TEMPLATE_LAYOUT)


def _number(value, fallback, minimum, maximum):
    try:
        value = float(value)
    except (TypeError, ValueError):
        return fallback
    return max(minimum, min(maximum, value))


def _color(value, fallback):
    value = str(value or "").strip()
    if len(value) == 7 and value.startswith("#") and all(char in "0123456789abcdefABCDEF" for char in value[1:]):
        return value
    return fallback


def normalized_template_layout(layout):
    layout = layout if isinstance(layout, dict) else {}
    try:
        header_image_id = int(layout["header_image_id"]) if layout.get("header_image_id") is not None else None
    except (TypeError, ValueError):
        header_image_id = None
    try:
        columns = int(layout.get("columns", 1))
    except (TypeError, ValueError):
        columns = 1
    columns = max(1, min(12, columns))
    source_widths = layout.get("column_widths") if isinstance(layout.get("column_widths"), list) else []
    widths = [_number(value, 1, 0.2, 10) for value in source_widths[:columns]]
    widths.extend([1] * (columns - len(widths)))
    header_height = _number(layout.get("header_height_mm"), 24, 18, 120)
    header_image_height = _number(
        layout.get("header_image_height_mm"),
        16,
        8,
        max(8, header_height - 4),
    )
    return {
        "page_width_mm": _number(layout.get("page_width_mm"), 210, 120, 420),
        "page_height_mm": _number(layout.get("page_height_mm"), 297, 120, 594),
        "roll_width_mm": _number(layout.get("roll_width_mm"), 80, 50, 120),
        "roll_height_mm": _number(layout.get("roll_height_mm"), 190, 100, 1000),
        "box_padding_mm": _number(layout.get("box_padding_mm"), 4, 1, 12),
        "header_image_id": header_image_id,
        "header_height_mm": header_height,
        "header_image_width_mm": _number(
            layout.get("header_image_width_mm"), 43, 15, 90
        ),
        "header_image_height_mm": header_image_height,
        "header_company_font_size": _number(
            layout.get("header_company_font_size"), 14, 9, 22
        ),
        "header_subtitle_font_size": _number(
            layout.get("header_subtitle_font_size"), 8, 6, 14
        ),
        "header_document_title": str(
            layout.get("header_document_title") or "COTIZACI\u00d3N"
        ).strip()[:80],
        "header_document_title_font_size": _number(
            layout.get("header_document_title_font_size"), 12, 9, 22
        ),
        "columns": columns,
        "column_gap_mm": _number(layout.get("column_gap_mm"), 1, 0, 12),
        "row_gap_mm": _number(layout.get("row_gap_mm"), 1, 0, 12),
        "column_widths": widths,
    }


def maximum_template_header_height_mm(sections, layout):
    """Calcula el espacio real que queda antes de sacar una sección de la hoja."""
    row_gap = max(0, float(layout.get("row_gap_mm", 1)))
    row_step = EDITOR_ROW_HEIGHT_MM + row_gap * EDITOR_GAP_SCALE
    first_position = None
    last_position = 0
    for section in sections or []:
        if not section.get("visible", True) or section.get("key") == "company":
            continue
        row = max(1, int(section.get("grid_row", 1)))
        row_span = max(3, int(section.get("row_span", 8)))
        section_grid_height = (
            row_span * EDITOR_ROW_HEIGHT_MM
            + max(0, row_span - 1) * row_gap * EDITOR_GAP_SCALE
        )
        reserved_height = max(
            float(section.get("min_height_mm", 0)),
            section_grid_height,
        )
        section_start = (row - 1) * row_step
        first_position = (
            section_start
            if first_position is None
            else min(first_position, section_start)
        )
        last_position = max(last_position, section_start + reserved_height)
    occupied_height = (
        last_position - first_position if first_position is not None else 0
    )
    available = STANDARD_FRAME_HEIGHT_MM - STANDARD_HEADER_GAP_MM - occupied_height
    return max(18, min(120, floor(available * 10) / 10))


def constrained_template_layout(layout, sections):
    """Limita encabezado y logo sin alterar la posición de las demás secciones."""
    constrained = dict(layout)
    maximum = maximum_template_header_height_mm(sections, constrained)
    header_height = min(float(constrained.get("header_height_mm", 24)), maximum)
    constrained["header_height_mm"] = header_height
    constrained["header_image_height_mm"] = min(
        float(constrained.get("header_image_height_mm", 16)),
        max(8, header_height - 4),
    )
    return constrained


def normalized_template_sections(sections):
    by_key = {item.get("key"): item for item in (sections or []) if isinstance(item, dict) and item.get("key")}
    normalized = []
    for position, default in enumerate(DEFAULT_TEMPLATE_SECTIONS, start=1):
        item = by_key.get(default["key"], {})
        max_row_span = 120 if default["key"] == "items" else 80
        normalized.append(
            {
                "key": default["key"],
                "type": "system",
                "title": str(item.get("title") or default["title"]).strip(),
                "visible": bool(item.get("visible", default["visible"])),
                "order": int(item.get("order", default["order"])),
                "content": str(item.get("content") or default["content"]).strip(),
                "show_savings": bool(item.get("show_savings", default.get("show_savings", True))),
                "width_percent": _number(item.get("width_percent"), 100, 30, 100),
                "min_height_mm": _number(item.get("min_height_mm"), 0, 0, 120),
                "grid_row": max(1, int(item.get("grid_row", position * 8))),
                "grid_column": max(1, int(item.get("grid_column", 1))),
                "column_span": max(1, int(item.get("column_span", 12))),
                "row_span": max(3, min(max_row_span, int(item.get("row_span", 8)))),
                "horizontal_align": item.get("horizontal_align") if item.get("horizontal_align") in {"left", "center", "right"} else "left",
                "vertical_align": item.get("vertical_align") if item.get("vertical_align") in {"top", "middle", "bottom"} else "top",
                "padding_mm": _number(item.get("padding_mm"), 3, 0, 12),
                "margin_mm": _number(item.get("margin_mm"), 0, 0, 10),
                "font_size": _number(item.get("font_size"), 9, 6, 18),
                "background_color": _color(item.get("background_color"), "#FFFFFF"),
                "text_color": _color(item.get("text_color"), "#233548"),
                "border_color": _color(item.get("border_color"), "#CBD5E1"),
                "border_width": _number(item.get("border_width"), 1, 0, 4),
                "border_radius": _number(item.get("border_radius"), 4, 0, 20),
            }
        )
    default_keys = {item["key"] for item in DEFAULT_TEMPLATE_SECTIONS}
    for position, item in enumerate(sections or [], start=len(normalized) + 1):
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or "").strip()
        section_type = item.get("type")
        if key in default_keys or section_type not in {"text", "image"}:
            continue
        image_id = item.get("image_id")
        try:
            image_id = int(image_id) if image_id is not None else None
        except (TypeError, ValueError):
            image_id = None
        normalized.append(
            {
                "key": key[:80],
                "type": section_type,
                "title": str(item.get("title") or ("Imagen" if section_type == "image" else "Información adicional")).strip()[:120],
                "visible": bool(item.get("visible", True)),
                "order": int(item.get("order", position * 10)),
                "content": str(item.get("content") or "").strip()[:4000],
                "image_id": image_id,
                "width_percent": _number(item.get("width_percent"), 100, 30, 100),
                "min_height_mm": _number(item.get("min_height_mm"), 0, 0, 120),
                "grid_row": max(1, int(item.get("grid_row", position * 8))),
                "grid_column": max(1, int(item.get("grid_column", 1))),
                "column_span": max(1, int(item.get("column_span", 12))),
                "row_span": max(3, min(80, int(item.get("row_span", 8)))),
                "horizontal_align": item.get("horizontal_align") if item.get("horizontal_align") in {"left", "center", "right"} else "left",
                "vertical_align": item.get("vertical_align") if item.get("vertical_align") in {"top", "middle", "bottom"} else "top",
                "padding_mm": _number(item.get("padding_mm"), 3, 0, 12),
                "margin_mm": _number(item.get("margin_mm"), 0, 0, 10),
                "font_size": _number(item.get("font_size"), 9, 6, 18),
                "background_color": _color(item.get("background_color"), "#FFFFFF"),
                "text_color": _color(item.get("text_color"), "#233548"),
                "border_color": _color(item.get("border_color"), "#CBD5E1"),
                "border_width": _number(item.get("border_width"), 1, 0, 4),
                "border_radius": _number(item.get("border_radius"), 4, 0, 20),
            }
        )
    return sorted(normalized, key=lambda item: item["order"])


def arranged_template_sections(sections, columns):
    """Asegura que la cuadrícula persistida no contenga rectángulos superpuestos."""
    columns = max(1, int(columns or 1))
    positioned = []
    for section in sorted(sections, key=lambda item: (item.get("grid_row", 1), item.get("order", 0))):
        item = dict(section)
        item["grid_column"] = min(max(1, item.get("grid_column", 1)), columns)
        item["column_span"] = min(max(1, item.get("column_span", 1)), columns - item["grid_column"] + 1)
        item["grid_row"] = max(1, item.get("grid_row", 1))
        while item.get("visible", True) and any(
            other.get("visible", True)
            and item["grid_row"] < other["grid_row"] + other.get("row_span", 7)
            and item["grid_row"] + item.get("row_span", 7) > other["grid_row"]
            and item["grid_column"] <= other["grid_column"] + other.get("column_span", 1) - 1
            and item["grid_column"] + item["column_span"] - 1 >= other["grid_column"]
            for other in positioned
        ):
            item["grid_row"] += 1
        item["order"] = item["grid_row"] * 10 + item["grid_column"]
        positioned.append(item)
    return positioned
