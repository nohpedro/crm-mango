import csv
from datetime import timedelta
from decimal import Decimal
from io import BytesIO, StringIO
from pathlib import Path
from xml.sax.saxutils import escape

from django.conf import settings
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from quotations.models import Quotation, QuotationItem

from .analytics import ALLOWED_STATUSES, _filter_period, _parse_bounds, _summary


BRAND = colors.HexColor("#173B67")
PALE = colors.HexColor("#EEF4F8")
TEXT = colors.HexColor("#233548")
STATUS_LABELS = {
    "all": "Pendientes y pagadas",
    Quotation.Status.PENDING: "Pendientes",
    Quotation.Status.PAID: "Pagadas",
}
LOGO_PATH = (
    Path(settings.BASE_DIR).parent
    / "frontend"
    / "src"
    / "assets"
    / "IDESEM_sin_fondo.png"
)


def _item_money_expression():
    return ExpressionWrapper(
        F("quantity") * F("unit_price"),
        output_field=DecimalField(max_digits=18, decimal_places=2),
    )


def client_report_data(client, start_date=None, end_date=None, quotation_status="all"):
    if quotation_status not in ALLOWED_STATUSES:
        raise ValueError("El estado debe ser all, pending o paid.")
    start, end = _parse_bounds(start_date, end_date)
    quotations = _filter_period(Quotation.objects.filter(client=client), start, end)
    if quotation_status != "all":
        quotations = quotations.filter(status=quotation_status)
    products = list(
        QuotationItem.objects.filter(quotation__in=quotations)
        .values("product_id", "sku", "name")
        .annotate(
            quotation_count=Count("quotation_id", distinct=True),
            total=Sum(_item_money_expression()),
            total_quantity=Sum("quantity"),
        )
        .order_by("-total_quantity", "-total", "name")
    )
    return {
        "client": client,
        "status": quotation_status,
        "status_label": STATUS_LABELS[quotation_status],
        "start": start.date() if start else None,
        "end": (end - timedelta(days=1)).date() if end else None,
        "summary": _summary(quotations),
        "products": products,
    }


def build_client_report_pdf(client, start_date=None, end_date=None, quotation_status="all"):
    data = client_report_data(client, start_date, end_date, quotation_status)
    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=letter,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=f"Reporte de cliente - {client.name}",
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="BrandTitle", parent=styles["Title"], textColor=BRAND, fontSize=17, leading=20))
    styles.add(ParagraphStyle(name="SmallRight", parent=styles["BodyText"], alignment=TA_RIGHT, fontSize=8, textColor=TEXT))
    story = []
    if LOGO_PATH.exists():
        logo = Image(str(LOGO_PATH), width=21 * mm, height=21 * mm)
        title = Paragraph("<b>REPORTE DEL CLIENTE</b><br/><font size='9'>CRM IDESEM</font>", styles["BrandTitle"])
        story.append(Table([[logo, title]], colWidths=[25 * mm, 150 * mm], style=[("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    else:
        story.append(Paragraph("REPORTE DEL CLIENTE - CRM IDESEM", styles["BrandTitle"]))
    story.append(Spacer(1, 5 * mm))
    period_label = (
        f"{data['start'].strftime('%d/%m/%Y')} al {(data['end']).strftime('%d/%m/%Y')}"
        if data["start"] and data["end"]
        else "Todo el historial"
    )
    client_rows = [
        [Paragraph("<b>Cliente</b>", styles["BodyText"]), Paragraph(escape(client.name), styles["BodyText"])],
        ["NIT/CI", client.tax_id],
        ["Teléfono", client.whatsapp],
        ["Tipo / nivel", f"{client.client_type} - {client.price_level.name}"],
        ["Periodo", period_label],
        ["Estado", data["status_label"]],
    ]
    client_table = Table(client_rows, colWidths=[34 * mm, 142 * mm])
    client_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), PALE),
        ("TEXTCOLOR", (0, 0), (0, -1), BRAND),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#C8D6E5")),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.extend([client_table, Spacer(1, 5 * mm)])
    summary = data["summary"]
    summary_table = Table(
        [["Cotizaciones", "Unidades", "Monto acumulado"], [summary["count"], summary["quantity"], f"Bs {summary['total']}"]],
        colWidths=[58 * mm, 58 * mm, 60 * mm],
    )
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BACKGROUND", (0, 1), (-1, 1), PALE),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]))
    story.extend([summary_table, Spacer(1, 6 * mm), Paragraph("Productos del cliente", styles["Heading2"]), Spacer(1, 2 * mm)])
    product_rows = [["Producto", "SKU", "Operaciones", "Cantidad", "Monto"]]
    for product in data["products"]:
        product_rows.append([
            Paragraph(escape(product["name"]), styles["BodyText"]),
            product["sku"],
            product["quotation_count"],
            product["total_quantity"] or 0,
            f"Bs {(product['total'] or Decimal('0.00')):.2f}",
        ])
    no_products = len(product_rows) == 1
    if no_products:
        product_rows.append([
            Paragraph("Sin productos para los filtros seleccionados.", styles["BodyText"]),
            "",
            "",
            "",
            "",
        ])
    products_table = Table(product_rows, repeatRows=1, colWidths=[65 * mm, 38 * mm, 25 * mm, 22 * mm, 27 * mm])
    products_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#C8D6E5")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
        ("PADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    if no_products:
        products_table.setStyle(TableStyle([
            ("SPAN", (0, 1), (-1, 1)),
            ("ALIGN", (0, 1), (-1, 1), "LEFT"),
        ]))
    story.append(products_table)
    document.build(story)
    return output.getvalue()


def build_client_report_csv(client, start_date=None, end_date=None, quotation_status="all"):
    data = client_report_data(client, start_date, end_date, quotation_status)
    output = StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["Cliente", client.name])
    writer.writerow(["NIT/CI", client.tax_id])
    writer.writerow(["Estado", data["status_label"]])
    writer.writerow(["Cotizaciones", data["summary"]["count"]])
    writer.writerow(["Unidades", data["summary"]["quantity"]])
    writer.writerow(["Monto acumulado", data["summary"]["total"]])
    writer.writerow([])
    writer.writerow(["Producto", "SKU", "Cotizaciones", "Cantidad", "Monto"])
    for product in data["products"]:
        writer.writerow([
            product["name"],
            product["sku"],
            product["quotation_count"],
            product["total_quantity"] or 0,
            f"{(product['total'] or Decimal('0.00')):.2f}",
        ])
    return output.getvalue().encode("utf-8-sig")
