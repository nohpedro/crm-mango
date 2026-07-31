from io import BytesIO
from math import ceil
from pathlib import Path
from xml.sax.saxutils import escape

from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .template_defaults import (
    EDITOR_GAP_SCALE,
    EDITOR_ROW_HEIGHT_MM,
    constrained_template_layout,
    default_template_layout,
    default_template_sections,
    normalized_template_layout,
    normalized_template_sections,
)


LOGO_PATH = Path(settings.BASE_DIR).parent / "frontend" / "src" / "assets" / "IDESEM_sin_fondo.png"
BRAND, ACCENT, PALE, TEXT = colors.HexColor("#173B67"), colors.HexColor("#0E9F6E"), colors.HexColor("#EEF4F8"), colors.HexColor("#233548")


def money(value):
    return f"Bs {value:,.2f}"


def styles_for(roll):
    sample, size = getSampleStyleSheet(), (7 if roll else 9)
    return {
        "body": ParagraphStyle("quotation-body", parent=sample["BodyText"], fontName="Helvetica", fontSize=size, leading=size + 3, textColor=TEXT),
        "small": ParagraphStyle("quotation-small", parent=sample["BodyText"], fontName="Helvetica", fontSize=max(6, size - 1), leading=size + 2, textColor=colors.HexColor("#607083")),
        "heading": ParagraphStyle("quotation-heading", parent=sample["Heading3"], fontName="Helvetica-Bold", fontSize=size + 1, leading=size + 4, textColor=BRAND, spaceAfter=2 * mm),
        "right": ParagraphStyle("quotation-right", parent=sample["BodyText"], fontName="Helvetica", fontSize=size, leading=size + 3, alignment=TA_RIGHT, textColor=TEXT),
    }


def paragraph(value, style):
    return Paragraph(str(value or "-").replace("\n", "<br/>"), style)


def snapshot_data(quotation):
    snapshot = quotation.template_snapshot or {}
    return (
        normalized_template_sections(snapshot.get("sections") or default_template_sections()),
        normalized_template_layout(snapshot.get("layout") or default_template_layout()),
        {item.get("id"): Path(item["path"]) for item in snapshot.get("images", []) if item.get("id") is not None and item.get("path")},
    )


def text_card(section, content, styles, width, padding):
    card_padding = section.get("padding_mm", padding)
    body = ParagraphStyle(
        f"section-body-{section['key']}", parent=styles["body"],
        fontSize=section.get("font_size", styles["body"].fontSize),
        textColor=colors.HexColor(section.get("text_color", "#233548")),
    )
    table = Table([[paragraph(section["title"].upper(), styles["heading"])], [paragraph(content, body)]], colWidths=[width], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(section.get("background_color", "#FFFFFF"))),
        ("LEFTPADDING", (0, 0), (-1, -1), card_padding * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), card_padding * mm),
        ("TOPPADDING", (0, 0), (-1, 0), card_padding * mm),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 0),
        ("TOPPADDING", (0, 1), (-1, 1), 0),
        ("BOTTOMPADDING", (0, 1), (-1, 1), card_padding * mm),
    ]))
    return table


def section_height(section, layout):
    """Convierte la altura de la cuadrícula del editor a una altura de impresión."""
    row_span = max(3, int(section.get("row_span", 8)))
    row_gap = max(0, float(layout.get("row_gap_mm", 1)))
    grid_height = (
        row_span * EDITOR_ROW_HEIGHT_MM
        + max(0, row_span - 1) * row_gap * EDITOR_GAP_SCALE
    )
    return max(float(section.get("min_height_mm", 0)), grid_height) * mm


def fitted_image_size(path, max_width, max_height):
    """Aprovecha el rectángulo disponible conservando la proporción original."""
    source_width, source_height = ImageReader(str(path)).getSize()
    if source_width <= 0 or source_height <= 0:
        return max_width, max_height
    scale = min(max_width / source_width, max_height / source_height)
    return source_width * scale, source_height * scale


def image_card(section, image_paths, styles, width, padding, target_height=None):
    path = image_paths.get(section.get("image_id"))
    path = Path(path) if path else None
    if not path or not path.exists():
        return text_card(section, "La imagen ya no está disponible.", styles, width, padding)
    card_padding = float(section.get("padding_mm", padding))
    target_height = target_height or min(width * 0.75, 80 * mm)
    available_width = max(10 * mm, width - 2 * card_padding * mm)
    available_height = max(10 * mm, target_height - 10 * mm - 2 * card_padding * mm)
    image_width, image_height = fitted_image_size(path, available_width, available_height)
    content = Image(str(path), width=image_width, height=image_height)
    content.hAlign = {
        "center": "CENTER",
        "right": "RIGHT",
    }.get(section.get("horizontal_align"), "LEFT")
    table = Table(
        [[paragraph(section["title"].upper(), styles["heading"])], [content]],
        colWidths=[width],
        hAlign="LEFT",
    )
    vertical_align = {
        "middle": "MIDDLE",
        "bottom": "BOTTOM",
    }.get(section.get("vertical_align"), "TOP")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(section.get("background_color", "#FFFFFF"))),
        ("LEFTPADDING", (0, 0), (-1, -1), card_padding * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), card_padding * mm),
        ("TOPPADDING", (0, 0), (-1, 0), card_padding * mm),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 0),
        ("TOPPADDING", (0, 1), (-1, 1), 0),
        ("BOTTOMPADDING", (0, 1), (-1, 1), card_padding * mm),
        ("VALIGN", (0, 1), (-1, 1), vertical_align),
    ]))
    return table


def standard_header(quotation, styles, width, layout, image_paths, sections):
    logo_path = image_paths.get(layout.get("header_image_id"), LOGO_PATH)
    snapshot_sections = (quotation.template_snapshot or {}).get("sections") or sections
    company_content = next(
        (
            section.get("content")
            for section in snapshot_sections
            if section.get("key") == "company"
        ),
        "",
    )
    company_lines = [line.strip() for line in str(company_content).splitlines() if line.strip()]
    company_name = company_lines[0] if company_lines else "IDESEM S.R.L."
    company_subtitle = company_lines[1] if len(company_lines) > 1 else "Soluciones comerciales y técnicas"
    company_size = float(layout.get("header_company_font_size", 14))
    subtitle_size = float(layout.get("header_subtitle_font_size", 8))
    document_title = str(layout.get("header_document_title") or "COTIZACI\u00d3N")
    document_title_size = float(layout.get("header_document_title_font_size", 12))
    header_height = float(layout.get("header_height_mm", 24)) * mm
    title_width = 54 * mm
    brand_width = width - title_width
    brand_style = ParagraphStyle(
        "quotation-header-brand",
        parent=styles["body"],
        fontSize=company_size,
        leading=company_size + 3,
        textColor=BRAND,
    )
    brand_text = Paragraph(
        f"<b>{escape(company_name)}</b><br/>"
        f"<font size='{subtitle_size}' color='#607083'>{escape(company_subtitle)}</font>",
        brand_style,
    )
    if logo_path.exists():
        requested_width = float(layout.get("header_image_width_mm", 43)) * mm
        requested_height = min(
            float(layout.get("header_image_height_mm", 16)),
            max(8, float(layout.get("header_height_mm", 24)) - 4),
        ) * mm
        max_logo_width = min(requested_width, max(15 * mm, brand_width - 42 * mm))
        logo_width, logo_height = fitted_image_size(
            logo_path,
            max_logo_width,
            requested_height,
        )
        logo = Image(str(logo_path), width=logo_width, height=logo_height)
        brand = Table(
            [[logo, brand_text]],
            colWidths=[logo_width + 3 * mm, brand_width - logo_width - 3 * mm],
            hAlign="LEFT",
        )
        brand.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
    else:
        brand = brand_text
    title = paragraph(
        f"<b><font size='{document_title_size}'>{escape(document_title)}</font></b>"
        f"<br/><font size=8>{quotation.number}</font>"
        f"<br/><font size=7>{quotation.created_at.strftime('%d/%m/%Y')}</font>",
        styles["right"],
    )
    table = Table(
        [[brand, title]],
        colWidths=[brand_width, title_width],
        rowHeights=[header_height],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LINEBELOW", (0, 0), (-1, -1), 1, BRAND),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
            ]
        )
    )
    return table


def roll_header(quotation, styles, width, selected_image_path=None):
    """Encabezado fijo para rollo; solo admite la imagen elegida en la plantilla."""
    centered = ParagraphStyle(
        "quotation-roll-centered",
        parent=styles["body"],
        alignment=TA_CENTER,
        leading=10,
    )
    centered_small = ParagraphStyle(
        "quotation-roll-centered-small",
        parent=styles["small"],
        alignment=TA_CENTER,
    )
    content = []
    selected_image_path = (
        Path(selected_image_path) if selected_image_path else None
    )
    if selected_image_path and selected_image_path.exists():
        logo_width, logo_height = fitted_image_size(
            selected_image_path,
            min(width * 0.72, 44 * mm),
            22 * mm,
        )
        logo = Image(
            str(selected_image_path),
            width=logo_width,
            height=logo_height,
        )
        logo.hAlign = "CENTER"
        content.extend([logo, Spacer(1, 2 * mm)])
    else:
        content.append(paragraph("<b>IDESEM S.R.L.</b>", centered))
    content.extend(
        [
            paragraph("<b>COTIZACIÓN</b>", centered),
            paragraph(quotation.number, centered),
            paragraph(quotation.created_at.strftime("%d/%m/%Y"), centered_small),
        ]
    )
    table = Table([[content]], colWidths=[width], hAlign="CENTER")
    table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("LINEBELOW", (0, 0), (-1, -1), 0.8, BRAND),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    return table


def roll_client_block(quotation, section, styles):
    """Cliente sin caja ni sangría para mantener el mismo eje que la tabla."""
    content = (
        f"<b>{quotation.client_name}</b><br/>"
        f"NIT/CI: {quotation.client_tax_id or '-'}<br/>"
        f"Teléfono: {quotation.client_phone or '-'}<br/>"
        f"{quotation.client_address or ''}"
    )
    return [
        paragraph(section["title"].upper(), styles["heading"]),
        paragraph(content, styles["body"]),
    ]


def items_table(quotation, styles, width, roll, items=None):
    items = list(items if items is not None else quotation.items.all())
    compact = roll or width < 115 * mm
    if compact:
        widths = [width * 0.55, width * 0.18, width * 0.27] if width < 55 * mm else [width - 36 * mm, 12 * mm, 24 * mm]
        data = [["Producto", "Cant.", "Total"]]
        for item in items: data.append([paragraph(f"<b>{item.name}</b><br/><font size=6>{item.sku}</font>", styles["body"]), str(item.quantity), paragraph(money(item.total), styles["right"])])
    else:
        data, widths = [["Producto", "Cantidad", "P. unitario", "Importe"]], [width - 90 * mm, 22 * mm, 34 * mm, 34 * mm]
        for item in items: data.append([paragraph(f"<b>{item.name}</b><br/><font size=7>{item.sku}</font>", styles["body"]), paragraph(str(item.quantity), styles["right"]), paragraph(money(item.unit_price), styles["right"]), paragraph(f"<b>{money(item.total)}</b>", styles["right"])])
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), BRAND), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, 0), 7 if compact else 8), ("ALIGN", (1, 0), (-1, -1), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D9E4EC")), ("LEFTPADDING", (0, 0), (-1, -1), 2.5 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 2.5 * mm), ("TOPPADDING", (0, 1), (-1, -1), 1 * mm), ("BOTTOMPADDING", (0, 1), (-1, -1), 1 * mm)]))
    return table


def totals_table(quotation, section, width, roll):
    savings = sum((item.savings for item in quotation.items.all()), 0)
    subtotal_label = "Subtotal" if width < 80 * mm else "Subtotal normal"
    rows = [["TOTAL", money(quotation.total)]] if roll else [[subtotal_label, money(quotation.total + savings)], ["TOTAL", money(quotation.total)]]
    if section.get("show_savings", True): rows.insert(0 if roll else 1, ["Ahorro", f"-{money(savings)}"])
    total_row = len(rows) - 1
    total_width = width * 0.48 if width < 70 * mm else (28 * mm if width < 115 * mm else 42 * mm)
    table = Table(rows, colWidths=[width - total_width, total_width], hAlign="RIGHT")
    table.setStyle(TableStyle([("ALIGN", (1, 0), (-1, -1), "RIGHT"), ("FONTNAME", (0, total_row), (-1, total_row), "Helvetica-Bold"), ("BACKGROUND", (0, total_row), (-1, total_row), PALE), ("LINEABOVE", (0, total_row), (-1, total_row), 0.8, BRAND), ("TOPPADDING", (0, 0), (-1, -1), 2 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm)]))
    table.setStyle(
        TableStyle(
            [
                ("RIGHTPADDING", (0, 0), (0, -1), 3 * mm),
                ("LEFTPADDING", (1, 0), (1, -1), 3 * mm),
            ]
        )
    )
    return table


def section_block(
    quotation,
    section,
    styles,
    width,
    roll,
    padding,
    image_paths,
    layout=None,
    item_rows=None,
):
    key = section["key"]
    if section.get("type") == "image":
        target_height = section_height(section, layout or {}) if not roll else None
        return image_card(section, image_paths, styles, width, padding, target_height)
    if section.get("type") == "text": return text_card(section, section.get("content"), styles, width, padding)
    if key == "company": return text_card(section, section.get("content"), styles, width, padding) if section.get("content") else None
    if key == "client":
        if roll:
            return roll_client_block(quotation, section, styles)
        client = f"<b>{quotation.client_name}</b><br/>NIT/CI: {quotation.client_tax_id or '-'}<br/>Teléfono: {quotation.client_phone or '-'}<br/>{quotation.client_address or ''}"
        return text_card(section, client, styles, width, padding)
    if key == "items":
        return [
            paragraph(section["title"], styles["heading"]),
            items_table(quotation, styles, width, roll, item_rows),
        ]
    if key == "totals": return totals_table(quotation, section, width, roll)
    content = section.get("content", "")
    if key == "validity": content = content or f"Esta cotización es válida por {quotation.valid_days} días."
    if key == "notes": content = quotation.notes or content
    return text_card(section, content, styles, width, padding) if content else None


def flowables_height(flowables, width):
    height = 0
    for flowable in flowables:
        _, flowable_height = flowable.wrap(width, 1000 * mm)
        height += flowable_height
    return height


def story_height_with_spacing(flowables, width):
    """Mide también los espacios de estilos que Platypus aplica al maquetar."""
    height = 0
    for flowable in flowables:
        _, flowable_height = flowable.wrap(width, 1000 * mm)
        height += (
            flowable_height
            + float(flowable.getSpaceBefore())
            + float(flowable.getSpaceAfter())
        )
    return height


def split_items_for_section(
    quotation,
    section,
    styles,
    width,
    layout,
    rows=None,
):
    """Divide por filas completas según la altura guardada para la caja."""
    rows = list(rows if rows is not None else quotation.items.all())
    if not rows:
        return [[]]
    available_height = section_height(section, layout)
    chunks, current = [], []
    for item in rows:
        candidate = current + [item]
        candidate_block = [
            paragraph(section["title"], styles["heading"]),
            items_table(quotation, styles, width, False, candidate),
        ]
        if current and flowables_height(candidate_block, width) > available_height:
            chunks.append(current)
            current = [item]
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def items_block_height(quotation, section, styles, width, rows):
    return flowables_height(
        [
            paragraph(section["title"], styles["heading"]),
            items_table(quotation, styles, width, False, rows),
        ],
        width,
    )


def take_items_that_fit(
    quotation,
    section,
    styles,
    width,
    rows,
    available_height,
    leave_at_least=0,
):
    """Toma el mayor prefijo posible sin consumir las filas reservadas."""
    maximum = max(0, len(rows) - leave_at_least)
    selected = []
    for item in rows[:maximum]:
        candidate = [*selected, item]
        if (
            selected
            and items_block_height(
                quotation,
                section,
                styles,
                width,
                candidate,
            )
            > available_height
        ):
            break
        selected = candidate
    if not selected and maximum:
        selected = [rows[0]]
    return selected


def take_last_items_that_fit(
    quotation,
    section,
    styles,
    width,
    rows,
    available_height,
):
    """Reserva el mayor sufijo posible para aprovechar la última página."""
    selected = []
    # Siempre deja al menos una fila para la primera página.
    for item in reversed(rows[1:]):
        candidate = [item, *selected]
        if (
            selected
            and items_block_height(
                quotation,
                section,
                styles,
                width,
                candidate,
            )
            > available_height
        ):
            break
        selected = candidate
    return selected or [rows[-1]]


def standard_pages(
    quotation,
    sections,
    styles,
    width,
    layout,
    image_paths,
    frame_height,
):
    """Planifica páginas aprovechando el espacio libre de las continuaciones."""
    item_section = next(
        (section for section in sections if section.get("key") == "items"),
        None,
    )
    if not item_section:
        return [(sections, None)]

    rows = list(quotation.items.all())
    item_width = section_print_width(item_section, width, layout)
    configured_chunks = split_items_for_section(
        quotation,
        item_section,
        styles,
        item_width,
        layout,
        rows,
    )
    if len(configured_chunks) <= 1:
        return [(sections, rows)]

    item_row = item_section.get("grid_row", 1)
    before = [
        section
        for section in sections
        if section.get("key") != "items"
        and section.get("grid_row", 1) < item_row
    ]
    after = [
        section
        for section in sections
        if section.get("key") != "items"
        and section.get("grid_row", 1) >= item_row
    ]
    def planned_height(page_sections, item_rows, include_header=False):
        story = []
        if include_header:
            story.extend(
                [
                    standard_header(
                        quotation,
                        styles,
                        width,
                        layout,
                        image_paths,
                        sections,
                    ),
                    Spacer(1, 5 * mm),
                ]
            )
        story.extend(
            positioned_grid_story(
                quotation,
                page_sections,
                styles,
                width,
                layout,
                image_paths,
                item_rows,
            )
        )
        return flowables_height(story, width)

    def maximum_prefix(source_rows, page_sections, include_header=False, limit=None):
        selected = []
        maximum = min(len(source_rows), limit or len(source_rows))
        for item in source_rows[:maximum]:
            candidate = [*selected, item]
            if planned_height(page_sections, candidate, include_header) > frame_height:
                break
            selected = candidate
        return selected

    first_item = dict(item_section)
    first_sections = before + [first_item]
    # Si existen secciones finales, conserva al menos un producto para la
    # última hoja y así evita crear otra página solo para totales o firmas.
    first_limit = len(rows) - 1 if after and len(rows) > 1 else len(rows)
    first_chunk = maximum_prefix(
        rows,
        first_sections,
        include_header=True,
        limit=first_limit,
    )
    if not first_chunk:
        first_chunk = [rows[0]]
    remaining = rows[len(first_chunk):]
    chunks = [first_chunk]

    final_item = {
        **item_section,
        "grid_row": 1,
        "title": f"{item_section['title']} (continuaciÃ³n)",
    }
    final_sections = [final_item] + after
    if remaining and planned_height(final_sections, remaining) <= frame_height:
        chunks.append(remaining)
        remaining = []

    if remaining:
        final_chunk = []
        for count in range(1, len(remaining) + 1):
            candidate = remaining[-count:]
            if planned_height(final_sections, candidate) > frame_height:
                break
            final_chunk = candidate
        if not final_chunk:
            final_chunk = [remaining[-1]]
        middle_rows = remaining[:-len(final_chunk)]
        middle_sections = [final_item]
        while middle_rows:
            chunk = maximum_prefix(middle_rows, middle_sections)
            if not chunk:
                chunk = [middle_rows[0]]
            chunks.append(chunk)
            middle_rows = middle_rows[len(chunk):]
        chunks.append(final_chunk)

    pages = []
    for index, chunk in enumerate(chunks):
        page_item = dict(item_section)
        if index:
            page_item["grid_row"] = 1
            page_item["title"] = (
                f"{item_section['title']} "
                f"(continuación {index + 1} de {len(chunks)})"
            )
        if index == 0:
            page_sections = before + [page_item]
        elif index == len(chunks) - 1:
            page_sections = [page_item] + after
        else:
            page_sections = [page_item]
        pages.append((page_sections, chunk))
    return pages


def grid_dimensions(width, layout):
    columns = layout.get("columns", 1)
    weights = list(layout.get("column_widths", [1] * columns)[:columns])
    weights.extend([1] * (columns - len(weights)))
    total = sum(weights) or 1
    return columns, [width * value / total for value in weights]


def section_print_width(section, width, layout):
    columns, col_widths = grid_dimensions(width, layout)
    start = min(max(1, section.get("grid_column", 1)), columns) - 1
    span = min(max(1, section.get("column_span", 1)), columns - start)
    gap = layout.get("column_gap_mm", 4) * mm
    return max(20 * mm, sum(col_widths[start:start + span]) - gap)


def grid_row_flowable(
    quotation,
    row_sections,
    styles,
    width,
    layout,
    image_paths,
    item_rows=None,
):
    columns, col_widths = grid_dimensions(width, layout)
    gap = layout.get("column_gap_mm", 4) * mm
    cells, spans = ["" for _ in range(columns)], []
    for section in sorted(row_sections, key=lambda item: item.get("grid_column", 1)):
        start = min(max(1, section.get("grid_column", 1)), columns) - 1
        span = min(max(1, section.get("column_span", 1)), columns - start)
        cell_width = max(20 * mm, sum(col_widths[start:start + span]) - gap)
        block = section_block(
            quotation,
            section,
            styles,
            cell_width,
            False,
            4,
            image_paths,
            layout,
            item_rows if section.get("key") == "items" else None,
        )
        if block is None:
            continue
        cells[start] = block if isinstance(block, list) else [block]
        if span > 1:
            spans.append(("SPAN", (start, 0), (start + span - 1, 0)))
    if not any(cells):
        return None
    table = Table([cells], colWidths=col_widths, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), gap / 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), gap / 2),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        *spans,
    ]))
    return table


def positioned_grid_story(
    quotation,
    sections,
    styles,
    width,
    layout,
    image_paths,
    item_rows=None,
):
    """Mantiene cada fila en su coordenada y reserva el alto configurado."""
    grouped = {}
    for section in sections:
        grouped.setdefault(section.get("grid_row", section.get("order", 10)), []).append(section)
    row_gap = max(0, float(layout.get("row_gap_mm", 1)))
    row_step = (EDITOR_ROW_HEIGHT_MM + row_gap * EDITOR_GAP_SCALE) * mm
    story, cursor = [], 0
    for row in sorted(grouped):
        row_sections = grouped[row]
        target = max(0, row - 1) * row_step
        if target > cursor:
            story.append(Spacer(1, target - cursor))
            cursor = target
        table = grid_row_flowable(
            quotation,
            row_sections,
            styles,
            width,
            layout,
            image_paths,
            item_rows,
        )
        if table is None:
            continue
        _, actual_height = table.wrap(width, 1000 * mm)
        reserved_height = max(section_height(section, layout) for section in row_sections)
        story.append(table)
        cursor = max(cursor + actual_height, target + reserved_height)
        if cursor > target + actual_height:
            story.append(Spacer(1, cursor - target - actual_height))
    return story


def constrained_layout_for_quotation(
    quotation,
    sections,
    styles,
    width,
    layout,
    image_paths,
    frame_height,
):
    """Evita que un encabezado alto cree otra hoja cuando el diseño aún cabe."""
    constrained = constrained_template_layout(layout, sections)
    item_section = next(
        (section for section in sections if section.get("key") == "items"),
        None,
    )
    item_rows = list(quotation.items.all())
    if item_section:
        item_width = section_print_width(item_section, width, constrained)
        if len(
            split_items_for_section(
                quotation,
                item_section,
                styles,
                item_width,
                constrained,
                item_rows,
            )
        ) > 1:
            return constrained, sections
    positioned_sections = sections
    body_story = positioned_grid_story(
        quotation,
        positioned_sections,
        styles,
        width,
        constrained,
        image_paths,
        item_rows,
    )
    header_story = [
        standard_header(
            quotation,
            styles,
            width,
            constrained,
            image_paths,
            sections,
        ),
        Spacer(1, 5 * mm),
    ]
    overflow = (
        flowables_height(header_story, width)
        + flowables_height(body_story, width)
        - frame_height
    )
    if overflow > 0 and positioned_sections:
        row_gap = max(0, float(constrained.get("row_gap_mm", 1)))
        row_step = (EDITOR_ROW_HEIGHT_MM + row_gap * EDITOR_GAP_SCALE) * mm
        first_row = min(
            section.get("grid_row", 1)
            for section in positioned_sections
            if section.get("visible", True)
        )
        rows_to_shift = min(
            max(0, first_row - 1),
            max(0, ceil(overflow / row_step)),
        )
        if rows_to_shift:
            positioned_sections = [
                {
                    **section,
                    "grid_row": max(
                        1,
                        section.get("grid_row", 1) - rows_to_shift,
                    ),
                }
                for section in positioned_sections
            ]
            body_story = positioned_grid_story(
                quotation,
                positioned_sections,
                styles,
                width,
                constrained,
                image_paths,
                item_rows,
            )
    maximum_header_height = max(
        18,
        (frame_height - flowables_height(body_story, width) - 5 * mm) / mm,
    )
    if constrained.get("header_height_mm", 24) <= maximum_header_height:
        return constrained, positioned_sections
    adjusted = dict(constrained)
    adjusted["header_height_mm"] = maximum_header_height
    adjusted["header_image_height_mm"] = min(
        adjusted.get("header_image_height_mm", 16),
        max(8, maximum_header_height - 4),
    )
    return adjusted, positioned_sections


def standard_story(
    quotation,
    sections,
    styles,
    width,
    layout,
    image_paths,
    frame_height,
):
    pages = standard_pages(
        quotation,
        sections,
        styles,
        width,
        layout,
        image_paths,
        frame_height,
    )
    story = []
    for index, (page_sections, item_rows) in enumerate(pages):
        if index:
            story.append(PageBreak())
        else:
            story.extend([
                standard_header(
                    quotation,
                    styles,
                    width,
                    layout,
                    image_paths,
                    sections,
                ),
                Spacer(1, 5 * mm),
            ])
        story.extend(
            positioned_grid_story(
                quotation,
                page_sections,
                styles,
                width,
                layout,
                image_paths,
                item_rows,
            )
        )
    return story


def draw_standard_footer(canvas, document):
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#607083"))
    canvas.drawCentredString(
        document.pagesize[0] / 2,
        6 * mm,
        f"IDESEM S.R.L. - Documento generado por CRM IDESEM - Página {document.page}",
    )
    canvas.restoreState()


def quotation_pdf(quotation, paper="standard"):
    roll = paper == "roll"
    sections, layout, image_paths = snapshot_data(quotation)
    # Los tamaños de impresión son fijos para que las plantillas solo definan el contenido de la hoja.
    page_width = (80 if roll else 216) * mm
    item_count = quotation.items.count()
    page_height = (279 if not roll else 135 + item_count * 12 + min(len(quotation.notes) // 60, 5) * 5) * mm
    page_size = (page_width, page_height)
    margin = 7 * mm if roll else 18 * mm
    width = page_width - margin * 2
    buffer = BytesIO()
    top_margin = (10 if roll else 9) * mm
    bottom_margin = 12 * mm
    styles = styles_for(roll)
    if roll:
        # El rollo es un comprobante estándar: solo hereda la imagen elegida para el encabezado.
        # SimpleDocTemplate reserva 6 pt internos por lado; usar ese ancho evita
        # que tablas y líneas queden desplazadas respecto de los textos.
        roll_content_width = max(40 * mm, width - 12)
        roll_sections = {section["key"]: section for section in default_template_sections()}
        selected_roll_image = (
            image_paths.get(layout.get("header_image_id"))
            if layout.get("header_image_id") is not None
            else None
        )
        story = [
            roll_header(
                quotation,
                styles,
                roll_content_width,
                selected_roll_image,
            ),
            Spacer(1, 4 * mm),
        ]
        for key in ("client", "items", "totals"):
            section = dict(roll_sections[key])
            if key == "totals":
                section["show_savings"] = any(item.savings > 0 for item in quotation.items.all())
            block = section_block(
                quotation,
                section,
                styles,
                roll_content_width,
                True,
                3,
                {},
            )
            if isinstance(block, list):
                story.extend(block)
            elif block:
                story.append(block)
            story.append(Spacer(1, 3 * mm))
        if quotation.notes:
            story.append(paragraph(quotation.notes, styles["small"]))
        roll_footer_style = ParagraphStyle(
            "quotation-roll-footer",
            parent=styles["small"],
            alignment=TA_CENTER,
        )
        story.append(
            paragraph(
                "IDESEM S.R.L. - Gracias por su preferencia",
                roll_footer_style,
            )
        )
        # El rollo es papel continuo: su alto termina exactamente después del
        # último bloque. Se incluyen los 6 pt internos de cada borde del marco
        # y una tolerancia mínima para evitar una segunda página por redondeo.
        roll_story_height = story_height_with_spacing(story, roll_content_width)
        page_height = (
            top_margin
            + bottom_margin
            + roll_story_height
            + 12
            + 4 * mm
        )
        document = SimpleDocTemplate(
            buffer,
            pagesize=(page_width, page_height),
            leftMargin=margin,
            rightMargin=margin,
            topMargin=top_margin,
            bottomMargin=bottom_margin,
            allowSplitting=0,
        )
        document.build(story)
        return buffer.getvalue()

    document = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=top_margin,
        bottomMargin=bottom_margin,
    )
    visible_sections = (item for item in sections if item.get("visible"))
    visible_sections = list(visible_sections)
    # La empresa ya se presenta en el encabezado; evita duplicarla como una caja adicional.
    visible_sections = [section for section in visible_sections if section.get("key") != "company"]
    frame_height = page_height - top_margin - bottom_margin - 12
    layout, visible_sections = constrained_layout_for_quotation(
        quotation,
        visible_sections,
        styles,
        width,
        layout,
        image_paths,
        frame_height,
    )
    story = standard_story(
        quotation,
        visible_sections,
        styles,
        width,
        layout,
        image_paths,
        # SimpleDocTemplate agrega 6 pt internos arriba y abajo al marco.
        # Descontarlos evita desbordamientos y páginas vacías con logos altos.
        frame_height,
    )
    document.build(
        story,
        onFirstPage=draw_standard_footer,
        onLaterPages=draw_standard_footer,
    )
    return buffer.getvalue()
