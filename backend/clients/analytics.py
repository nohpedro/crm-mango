from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.core.paginator import Paginator
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from quotations.models import Quotation, QuotationItem


REPORT_TIMEZONE = ZoneInfo("America/La_Paz")
ALLOWED_STATUSES = {"all", Quotation.Status.PAID, Quotation.Status.PENDING}


def _money_expression(prefix="items__"):
    return ExpressionWrapper(
        F(f"{prefix}quantity") * F(f"{prefix}unit_price"),
        output_field=DecimalField(max_digits=18, decimal_places=2),
    )


def _parse_bounds(start_date, end_date):
    if not start_date and not end_date:
        return None, None
    if not start_date or not end_date:
        raise ValueError("Selecciona una fecha inicial y una fecha final.")
    try:
        start_value = date.fromisoformat(str(start_date))
        end_value = date.fromisoformat(str(end_date))
    except ValueError as error:
        raise ValueError("Las fechas deben usar el formato AAAA-MM-DD.") from error
    if start_value > end_value:
        raise ValueError("La fecha inicial no puede ser posterior a la fecha final.")
    start = datetime.combine(start_value, time.min, tzinfo=REPORT_TIMEZONE)
    end = datetime.combine(end_value + timedelta(days=1), time.min, tzinfo=REPORT_TIMEZONE)
    return start, end


def _filter_period(queryset, start, end):
    if start is not None:
        queryset = queryset.filter(
            quotation_date__gte=start.date(),
            quotation_date__lt=end.date(),
        )
    return queryset


def _summary(queryset):
    values = queryset.aggregate(
        quotation_count=Count("id", distinct=True),
        quantity=Sum("items__quantity"),
        total=Sum(_money_expression()),
    )
    return {
        "count": values["quotation_count"] or 0,
        "quantity": values["quantity"] or 0,
        "total": f"{(values['total'] or Decimal('0.00')):.2f}",
    }


def _frequency(queryset):
    dates = list(
        queryset.order_by("quotation_date").values_list("quotation_date", flat=True)
    )
    if not dates:
        return {"label": "Sin actividad", "average_days": None}
    if len(dates) == 1:
        return {"label": "Primera operación", "average_days": None}
    differences = [
        max(0, (current - previous).days)
        for previous, current in zip(dates, dates[1:])
    ]
    average = round(sum(differences) / len(differences))
    if average <= 30:
        label = "Frecuente"
    elif average <= 90:
        label = "Regular"
    else:
        label = "Ocasional"
    return {"label": label, "average_days": average}


def _serialize_history(queryset, page, page_size):
    try:
        page = max(1, int(page))
        page_size = min(20, max(5, int(page_size)))
    except (TypeError, ValueError) as error:
        raise ValueError("La paginación no tiene un formato válido.") from error
    rows = queryset.annotate(
        products_count=Count("items", distinct=True),
        quantity=Sum("items__quantity"),
        total_amount=Sum(_money_expression()),
    ).order_by("-quotation_date", "-created_at", "-id")
    paginator = Paginator(rows, page_size)
    current = paginator.get_page(page)
    return {
        "count": paginator.count,
        "page": current.number,
        "page_size": page_size,
        "total_pages": paginator.num_pages,
        "results": [
            {
                "id": quotation.id,
                "number": quotation.number,
                "status": quotation.status,
                "quotation_date": quotation.quotation_date.isoformat(),
                "created_at": quotation.created_at.astimezone(REPORT_TIMEZONE).isoformat(),
                "products_count": quotation.products_count,
                "quantity": quotation.quantity or 0,
                "total": f"{(quotation.total_amount or Decimal('0.00')):.2f}",
            }
            for quotation in current.object_list
        ],
    }


def client_analytics(
    client,
    start_date=None,
    end_date=None,
    quotation_status="all",
    page=1,
    page_size=10,
):
    if quotation_status not in ALLOWED_STATUSES:
        raise ValueError("El estado debe ser all, pending o paid.")
    start, end = _parse_bounds(start_date, end_date)
    lifetime = Quotation.objects.filter(client=client)
    filtered = _filter_period(lifetime, start, end)
    if quotation_status != "all":
        filtered = filtered.filter(status=quotation_status)

    monthly_rows = (
        filtered.annotate(month=TruncMonth("quotation_date"))
        .values("month")
        .annotate(
            count=Count("id", distinct=True),
            quantity=Sum("items__quantity"),
            total=Sum(_money_expression()),
        )
        .order_by("month")
    )
    products = (
        QuotationItem.objects.filter(quotation__in=filtered)
        .values("product_id", "sku", "name")
        .annotate(
            quotation_count=Count("quotation_id", distinct=True),
            total=Sum(_money_expression(prefix="")),
            quantity=Sum("quantity"),
        )
        .order_by("-quantity", "-total", "name")[:10]
    )
    last_paid = lifetime.filter(status=Quotation.Status.PAID).order_by(
        "-quotation_date", "-created_at"
    ).first()
    last_activity = lifetime.order_by("-quotation_date", "-created_at").first()

    return {
        "generated_at": timezone.now().astimezone(REPORT_TIMEZONE).isoformat(),
        "client": {
            "id": str(client.pk),
            "name": client.name,
            "tax_id": client.tax_id,
            "whatsapp": client.whatsapp,
            "department": client.department,
            "city_zone": client.city_zone,
            "client_type": client.client_type,
            "price_level": {
                "id": str(client.price_level_id),
                "name": client.price_level.name,
                "code": client.price_level.code,
            },
            "business_activity": client.business_activity,
        },
        "status": quotation_status,
        "range": {
            "start": start.date().isoformat() if start else None,
            "end": (end - timedelta(days=1)).date().isoformat() if end else None,
        },
        "lifetime": {
            "all": _summary(lifetime),
            "paid": _summary(lifetime.filter(status=Quotation.Status.PAID)),
            "pending": _summary(lifetime.filter(status=Quotation.Status.PENDING)),
        },
        "selected": _summary(filtered),
        "frequency": _frequency(filtered),
        "last_purchase_at": (
            last_paid.quotation_date.isoformat()
            if last_paid
            else None
        ),
        "last_activity_at": (
            last_activity.quotation_date.isoformat()
            if last_activity
            else None
        ),
        "monthly": [
            {
                "month": row["month"].isoformat(),
                "label": row["month"].strftime("%m/%Y"),
                "count": row["count"],
                "quantity": row["quantity"] or 0,
                "total": f"{(row['total'] or Decimal('0.00')):.2f}",
            }
            for row in monthly_rows
        ],
        "top_products": [
            {
                "product_id": str(row["product_id"]) if row["product_id"] else None,
                "sku": row["sku"],
                "name": row["name"],
                "quotation_count": row["quotation_count"],
                "quantity": row["quantity"] or 0,
                "total": f"{(row['total'] or Decimal('0.00')):.2f}",
            }
            for row in products
        ],
        "history": _serialize_history(filtered, page, page_size),
    }
