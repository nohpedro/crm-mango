import csv
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from io import BytesIO, StringIO
from pathlib import Path
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import Quotation, QuotationItem


REPORT_TIMEZONE = ZoneInfo("America/La_Paz")
LOGO_PATH = (
    Path(settings.BASE_DIR).parent
    / "frontend"
    / "src"
    / "assets"
    / "IDESEM_sin_fondo.png"
)
BRAND = colors.HexColor("#173B67")
ACCENT = colors.HexColor("#0E9F6E")
PALE = colors.HexColor("#EEF4F8")
TEXT = colors.HexColor("#233548")
PERIOD_LABELS = {
    "day": "Hoy",
    "week": "Esta semana",
    "month": "Este mes",
    "custom": "Rango personalizado",
}


def _period_bounds(period, now=None, start_date=None, end_date=None):
    if period not in PERIOD_LABELS:
        raise ValueError("El periodo debe ser day, week, month o custom.")
    current = (now or timezone.now()).astimezone(REPORT_TIMEZONE)
    today = current.date()
    if period == "custom":
        if not start_date or not end_date:
            raise ValueError("Selecciona la fecha inicial y la fecha final.")
        try:
            start_date = date.fromisoformat(str(start_date))
            end_date = date.fromisoformat(str(end_date))
        except ValueError as error:
            raise ValueError("Las fechas deben usar el formato AAAA-MM-DD.") from error
        if start_date > end_date:
            raise ValueError("La fecha inicial no puede ser posterior a la fecha final.")
        if (end_date - start_date).days > 366:
            raise ValueError("El rango personalizado no puede superar 366 días.")
    elif period == "day":
        start_date = today
    elif period == "week":
        start_date = today - timedelta(days=today.weekday())
        end_date = today
    else:
        start_date = today.replace(day=1)
        end_date = today
    if period == "day":
        end_date = today
    start = datetime.combine(start_date, time.min, tzinfo=REPORT_TIMEZONE)
    end = datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=REPORT_TIMEZONE)
    return start, end


def _issued_between(start, end):
    return Quotation.objects.filter(
        status=Quotation.Status.ISSUED,
        created_at__gte=start,
        created_at__lt=end,
    )


def _money_expression():
    return ExpressionWrapper(
        F("items__quantity") * F("items__unit_price"),
        output_field=DecimalField(max_digits=18, decimal_places=2),
    )


def _item_money_expression():
    return ExpressionWrapper(
        F("quantity") * F("unit_price"),
        output_field=DecimalField(max_digits=18, decimal_places=2),
    )


def _queryset_summary(queryset):
    values = queryset.aggregate(total=Sum(_money_expression()))
    total = values["total"] or Decimal("0.00")
    count = queryset.count()
    return {
        "count": count,
        "total": f"{total:.2f}",
        "average": f"{(total / count if count else Decimal('0.00')):.2f}",
    }


def _summary(period, now=None):
    start, end = _period_bounds(period, now)
    queryset = _issued_between(start, end)
    return _queryset_summary(queryset)


def dashboard_data(
    period="month",
    now=None,
    start_date=None,
    end_date=None,
):
    start, end = _period_bounds(period, now, start_date, end_date)
    quotations = _issued_between(start, end)
    summaries = {
        key: _summary(key, now)
        for key in ("day", "week", "month")
    }

    grouped_days = {
        item["day"]: item
        for item in quotations.annotate(
            day=TruncDate("created_at", tzinfo=REPORT_TIMEZONE)
        )
        .values("day")
        .annotate(
            count=Count("id", distinct=True),
            total=Sum(_money_expression()),
        )
        .order_by("day")
    }
    day = start.date()
    series = []
    while day < end.date():
        row = grouped_days.get(day, {})
        series.append(
            {
                "date": day.isoformat(),
                "label": day.strftime("%d/%m"),
                "count": row.get("count", 0),
                "total": f"{(row.get('total') or Decimal('0.00')):.2f}",
            }
        )
        day += timedelta(days=1)

    items = QuotationItem.objects.filter(quotation__in=quotations)
    top_products = list(
        items.values("product_id", "sku", "name")
        .annotate(
            quotation_count=Count("quotation_id", distinct=True),
            quoted_quantity=Sum("quantity"),
            total=Sum(_item_money_expression()),
        )
        .order_by("-quoted_quantity", "-quotation_count", "name")[:5]
    )
    top_clients = list(
        quotations.values("client_id", "client_name", "client_tax_id")
        .annotate(
            quotation_count=Count("id", distinct=True),
            total=Sum(_money_expression()),
        )
        .order_by("-quotation_count", "-total", "client_name")[:5]
    )
    for row in top_products + top_clients:
        row["total"] = f"{(row.get('total') or Decimal('0.00')):.2f}"
        if row.get("product_id") is not None:
            row["product_id"] = str(row["product_id"])
    for row in top_products:
        row["quantity"] = row.pop("quoted_quantity")

    selected = (
        _queryset_summary(quotations)
        if period == "custom"
        else summaries[period]
    )
    return {
        "generated_at": (now or timezone.now())
        .astimezone(REPORT_TIMEZONE)
        .isoformat(),
        "period": {
            "key": period,
            "label": PERIOD_LABELS[period],
            "start": start.date().isoformat(),
            "end": (end - timedelta(microseconds=1)).date().isoformat(),
        },
        "sales": summaries,
        "selected": selected,
        "series": series,
        "top_products": top_products,
        "top_clients": top_clients,
        "definition": "Se consideran ventas las cotizaciones emitidas.",
    }


def report_csv(period="month", now=None, start_date=None, end_date=None):
    start, end = _period_bounds(period, now, start_date, end_date)
    rows = (
        QuotationItem.objects.filter(
            quotation__status=Quotation.Status.ISSUED,
            quotation__created_at__gte=start,
            quotation__created_at__lt=end,
        )
        .select_related("quotation", "product")
        .order_by("quotation__created_at", "quotation__number", "id")
    )
    output = StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(
        [
            "Fecha",
            "Número de cotización",
            "Cliente",
            "NIT/CI",
            "SKU",
            "Producto",
            "Cantidad",
            "Precio normal",
            "Precio aplicado",
            "Ahorro",
            "Subtotal",
            "Estado",
        ]
    )
    for item in rows:
        created = item.quotation.created_at.astimezone(REPORT_TIMEZONE)
        writer.writerow(
            [
                created.strftime("%d/%m/%Y %H:%M"),
                item.quotation.number,
                item.quotation.client_name,
                item.quotation.client_tax_id,
                item.sku,
                item.name,
                item.quantity,
                f"{item.normal_unit_price:.2f}",
                f"{item.unit_price:.2f}",
                f"{item.savings:.2f}",
                f"{item.total:.2f}",
                item.quotation.get_status_display(),
            ]
        )
    return "\ufeff" + output.getvalue()


def _pdf_styles():
    sample = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "report-title",
            parent=sample["Title"],
            fontName="Helvetica-Bold",
            fontSize=19,
            leading=23,
            textColor=BRAND,
        ),
        "heading": ParagraphStyle(
            "report-heading",
            parent=sample["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=BRAND,
            spaceAfter=3 * mm,
        ),
        "body": ParagraphStyle(
            "report-body",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=TEXT,
        ),
        "small": ParagraphStyle(
            "report-small",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=7,
            leading=9,
            textColor=colors.HexColor("#607083"),
        ),
        "right": ParagraphStyle(
            "report-right",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            alignment=TA_RIGHT,
            textColor=TEXT,
        ),
        "center": ParagraphStyle(
            "report-center",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            alignment=TA_CENTER,
            textColor=TEXT,
        ),
        "metric_label": ParagraphStyle(
            "report-metric-label",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#607083"),
        ),
        "metric_value": ParagraphStyle(
            "report-metric-value",
            parent=sample["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=17,
            leading=21,
            alignment=TA_CENTER,
            textColor=TEXT,
        ),
        "metric_detail": ParagraphStyle(
            "report-metric-detail",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=TEXT,
        ),
    }


def _table(data, widths, header=True):
    table = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D9E4EC")),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
    ]
    if header:
        commands.extend(
            [
                ("BACKGROUND", (0, 0), (-1, 0), BRAND),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ]
        )
    table.setStyle(TableStyle(commands))
    return table


def report_pdf(period="month", now=None, start_date=None, end_date=None):
    data = dashboard_data(period, now, start_date, end_date)
    styles = _pdf_styles()
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=15 * mm,
        bottomMargin=14 * mm,
        title=f"Reporte de ventas - {data['period']['label']}",
        author="IDESEM S.R.L.",
    )
    width = landscape(letter)[0] - 28 * mm
    story = []

    logo = (
        Image(str(LOGO_PATH), width=34 * mm, height=14 * mm, kind="proportional")
        if LOGO_PATH.exists()
        else Paragraph("<b>IDESEM S.R.L.</b>", styles["heading"])
    )
    report_title = Paragraph(
        f"Reporte de ventas<br/><font size='9'>{data['period']['label']} - "
        f"{datetime.fromisoformat(data['period']['start']).strftime('%d/%m/%Y')} al "
        f"{datetime.fromisoformat(data['period']['end']).strftime('%d/%m/%Y')}</font>",
        styles["title"],
    )
    generated = Paragraph(
        f"Generado: {datetime.fromisoformat(data['generated_at']).strftime('%d/%m/%Y %H:%M')}",
        styles["right"],
    )
    header = Table([[logo, report_title, generated]], colWidths=[42 * mm, width - 92 * mm, 50 * mm])
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LINEBELOW", (0, 0), (-1, -1), 1.1, BRAND),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
            ]
        )
    )
    story.extend([header, Spacer(1, 5 * mm)])

    selected = data["selected"]
    cards = [
        [
            Paragraph("Total cotizado", styles["metric_label"]),
            Paragraph(
                f"Bs {Decimal(selected['total']):,.2f}",
                styles["metric_value"],
            ),
            Paragraph(data["period"]["label"], styles["metric_detail"]),
        ],
        [
            Paragraph("Cotizaciones emitidas", styles["metric_label"]),
            Paragraph(str(selected["count"]), styles["metric_value"]),
            Paragraph("Documentos incluidos", styles["metric_detail"]),
        ],
        [
            Paragraph("Promedio por cotización", styles["metric_label"]),
            Paragraph(
                f"Bs {Decimal(selected['average']):,.2f}",
                styles["metric_value"],
            ),
            Paragraph("Importe promedio", styles["metric_detail"]),
        ],
    ]
    summary_table = Table([cards], colWidths=[width / 3] * 3)
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#D9E4EC")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D9E4EC")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
            ]
        )
    )
    story.extend([summary_table, Spacer(1, 6 * mm)])

    product_rows = [["Producto", "Cotizaciones", "Cantidad", "Total"]]
    for row in data["top_products"]:
        product_rows.append(
            [
                Paragraph(f"<b>{row['name']}</b><br/><font size='7'>{row['sku']}</font>", styles["body"]),
                str(row["quotation_count"]),
                str(row["quantity"]),
                f"Bs {Decimal(row['total']):,.2f}",
            ]
        )
    if len(product_rows) == 1:
        product_rows.append(["Sin datos en el periodo", "-", "-", "-"])

    client_rows = [["Cliente", "NIT/CI", "Cotizaciones", "Total"]]
    for row in data["top_clients"]:
        client_rows.append(
            [
                Paragraph(row["client_name"], styles["body"]),
                row["client_tax_id"] or "-",
                str(row["quotation_count"]),
                f"Bs {Decimal(row['total']):,.2f}",
            ]
        )
    if len(client_rows) == 1:
        client_rows.append(["Sin datos en el periodo", "-", "-", "-"])

    half = (width - 6 * mm) / 2
    products_block = [
        Paragraph("Productos más cotizados", styles["heading"]),
        _table(product_rows, [half - 76 * mm, 27 * mm, 22 * mm, 27 * mm]),
    ]
    clients_block = [
        Paragraph("Clientes con más cotizaciones", styles["heading"]),
        _table(client_rows, [half - 78 * mm, 25 * mm, 26 * mm, 27 * mm]),
    ]
    rankings = Table([[products_block, clients_block]], colWidths=[half, half], hAlign="LEFT")
    rankings.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 3 * mm),
                ("LEFTPADDING", (1, 0), (1, 0), 3 * mm),
                ("RIGHTPADDING", (1, 0), (1, 0), 0),
            ]
        )
    )
    story.extend(
        [
            rankings,
            Spacer(1, 5 * mm),
            Paragraph(data["definition"], styles["small"]),
        ]
    )

    def page_footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#D9E4EC"))
        canvas.line(14 * mm, 10 * mm, landscape(letter)[0] - 14 * mm, 10 * mm)
        canvas.setFillColor(colors.HexColor("#607083"))
        canvas.setFont("Helvetica", 7)
        canvas.drawString(14 * mm, 6 * mm, "IDESEM S.R.L. - CRM comercial")
        canvas.drawRightString(
            landscape(letter)[0] - 14 * mm,
            6 * mm,
            f"Página {doc.page}",
        )
        canvas.restoreState()

    document.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
    return buffer.getvalue()
