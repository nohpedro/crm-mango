import base64
import re
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from reportlab.lib.units import mm
from rest_framework import status
from rest_framework.test import APITestCase

from clients.models import Client, ClientType
from products.models import Category, PriceLevel, PriceTier, Product, ProductPrice
from users.models import Role

from .models import Quotation, QuotationTemplate
from .reports import REPORT_TIMEZONE
from .pdf import (
    fitted_image_size,
    image_card,
    quotation_pdf,
    roll_client_block,
    roll_header,
    section_height,
    split_items_for_section,
    standard_header,
    standard_pages,
    styles_for,
    text_card,
    totals_table,
)
from .template_defaults import (
    arranged_template_sections,
    constrained_template_layout,
    default_template_layout,
    default_template_sections,
    maximum_template_header_height_mm,
    normalized_template_sections,
)


class QuotationApiTests(APITestCase):
    def setUp(self):
        role = Role.objects.create(name="Ventas", code="SALES")
        role.permissions.add(
            *Permission.objects.filter(
                content_type__app_label__in=["quotations", "clients", "products"],
                codename__in=[
                    "add_quotation",
                    "view_quotation",
                    "view_dashboard",
                    "change_quotation",
                    "configure_quotation_document",
                    "manage_quotation_templates",
                    "view_client",
                    "view_product",
                ],
            )
        )
        self.user = get_user_model().objects.create_user(
            username="sales",
            email="sales@example.com",
            password="safe-password",
            role=role,
        )
        self.client.force_authenticate(self.user)
        level = PriceLevel.objects.create(name="Regular", code="REG")
        ClientType.objects.create(name="Empresa")
        self.customer = Client.objects.create(
            name="Cliente de prueba", tax_id="12345", department="La Paz", city_zone="Centro",
            whatsapp="70000000", client_type="Empresa", price_level=level, business_activity="Comercio"
        )
        category = Category.objects.create(name="Calefones", code="CALEFONES")
        self.product = Product.objects.create(category=category, name="Calefón 10L", sku="CAL-10", normal_unit_price="20.00")

    def payload(self):
        return {
            "client": self.customer.id,
            "client_name": self.customer.name,
            "client_tax_id": self.customer.tax_id,
            "client_phone": self.customer.whatsapp,
            "client_address": "Centro, La Paz",
            "valid_days": 7,
            "notes": "Entrega coordinada.",
            "status": "pending",
            "items": [{"product": self.product.id, "quantity": 2, "unit_price": "250.50"}],
        }

    def test_hidden_company_section_removes_standard_header_from_pdf(self):
        sections = default_template_sections()
        next(item for item in sections if item["key"] == "company")["visible"] = False
        template = QuotationTemplate.objects.create(
            name="Sin encabezado",
            sections=sections,
            layout=default_template_layout(),
        )
        payload = {**self.payload(), "template": template.id}
        response = self.client.post("/api/v1/quotations/", payload, format="json")
        quotation = Quotation.objects.get(pk=response.data["id"])

        with patch("quotations.pdf.standard_header", wraps=standard_header) as header:
            document = quotation_pdf(quotation, "standard")

        self.assertTrue(document.startswith(b"%PDF"))
        header.assert_not_called()

    def test_header_does_not_change_saved_card_positions(self):
        sections = default_template_sections()
        for section in sections:
            section.update(
                {
                    "visible": section["key"] in {"company", "client", "items"},
                    "grid_row": 1,
                    "grid_column": 1,
                    "column_span": 12,
                    "row_span": 8,
                }
            )
        next(item for item in sections if item["key"] == "company")["row_span"] = 80
        next(item for item in sections if item["key"] == "items")["grid_row"] = 12

        response = self.client.post(
            "/api/v1/quotations/templates/",
            {
                "name": "Posiciones estables",
                "sections": sections,
                "layout": default_template_layout(),
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        saved = {section["key"]: section for section in response.data["sections"]}
        self.assertEqual(saved["client"]["grid_row"], 1)
        self.assertEqual(saved["items"]["grid_row"], 12)

    def test_document_configuration_requires_its_own_permission(self):
        limited_role = Role.objects.create(name="Cotizador básico", code="BASIC_SALES")
        limited_role.permissions.add(
            *Permission.objects.filter(
                content_type__app_label="quotations",
                codename__in=["add_quotation", "view_quotation"],
            ),
            Permission.objects.get(
                content_type__app_label="clients",
                codename="view_client",
            ),
            Permission.objects.get(
                content_type__app_label="products",
                codename="view_product",
            )
        )
        limited_user = get_user_model().objects.create_user(
            username="basic-sales",
            email="basic-sales@example.com",
            password="safe-password",
            role=limited_role,
        )
        self.client.force_authenticate(limited_user)

        rejected = self.client.post("/api/v1/quotations/", self.payload(), format="json")
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("template", rejected.data)

        payload = self.payload()
        payload.pop("valid_days")
        accepted = self.client.post("/api/v1/quotations/", payload, format="json")
        self.assertEqual(accepted.status_code, status.HTTP_201_CREATED)

    def test_template_permissions_are_independent_from_editing_quotations(self):
        template = QuotationTemplate.objects.create(name="Plantilla protegida")
        role = Role.objects.create(name="Configura documentos", code="DOC_CONFIG")
        role.permissions.add(
            Permission.objects.get(
                content_type__app_label="quotations",
                codename="configure_quotation_document",
            )
        )
        user = get_user_model().objects.create_user(
            username="doc-config",
            email="doc-config@example.com",
            password="safe-password",
            role=role,
        )
        self.client.force_authenticate(user)

        listed = self.client.get("/api/v1/quotations/templates/")
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        denied = self.client.patch(
            f"/api/v1/quotations/templates/{template.pk}/",
            {"name": "No permitido"},
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        role.permissions.add(
            Permission.objects.get(
                content_type__app_label="quotations",
                codename="manage_quotation_templates",
            )
        )
        allowed = self.client.patch(
            f"/api/v1/quotations/templates/{template.pk}/",
            {"name": "Plantilla administrada"},
            format="json",
        )
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)

    def test_creates_and_generates_both_pdf_formats(self):
        response = self.client.post("/api/v1/quotations/", self.payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["number"], "COT-000001")
        self.assertEqual(response.data["total"], "40.00")
        for paper in ("standard", "roll"):
            document = self.client.get(f"/api/v1/quotations/{response.data['id']}/pdf/?paper={paper}")
            self.assertEqual(document.status_code, status.HTTP_200_OK)
            self.assertEqual(document["Content-Type"], "application/pdf")
            self.assertTrue(document.content.startswith(b"%PDF"))

    def test_roll_pdf_uses_one_continuous_page_for_short_and_long_quotes(self):
        short_response = self.client.post(
            "/api/v1/quotations/",
            self.payload(),
            format="json",
        )
        self.assertEqual(short_response.status_code, status.HTTP_201_CREATED)
        long_payload = self.payload()
        long_payload["items"] = [
            {
                "product": self.product.id,
                "quantity": index,
                "unit_price": "20.00",
            }
            for index in range(1, 31)
        ]
        long_response = self.client.post(
            "/api/v1/quotations/",
            long_payload,
            format="json",
        )
        self.assertEqual(long_response.status_code, status.HTTP_201_CREATED)

        short_document = quotation_pdf(
            Quotation.objects.get(pk=short_response.data["id"]),
            "roll",
        )
        long_document = quotation_pdf(
            Quotation.objects.get(pk=long_response.data["id"]),
            "roll",
        )
        short_pages = len(re.findall(rb"/Type\s*/Page\b", short_document))
        long_pages = len(re.findall(rb"/Type\s*/Page\b", long_document))
        short_box = re.search(
            rb"/MediaBox\s*\[\s*0\s+0\s+[\d.]+\s+([\d.]+)\s*\]",
            short_document,
        )
        long_box = re.search(
            rb"/MediaBox\s*\[\s*0\s+0\s+[\d.]+\s+([\d.]+)\s*\]",
            long_document,
        )

        self.assertEqual(short_pages, 1)
        self.assertEqual(long_pages, 1)
        self.assertIsNotNone(short_box)
        self.assertIsNotNone(long_box)
        self.assertGreater(float(long_box.group(1)), float(short_box.group(1)))

    def test_continuation_pages_expand_products_without_repeating_client(self):
        payload = self.payload()
        payload["items"] = [
            {
                "product": self.product.id,
                "quantity": index,
                "unit_price": "20.00",
            }
            for index in range(1, 6)
        ]
        response = self.client.post("/api/v1/quotations/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        quotation = Quotation.objects.prefetch_related("items").get(pk=response.data["id"])
        layout = default_template_layout()
        sections = normalized_template_sections(default_template_sections())
        for section in sections:
            section["visible"] = section["key"] in {"client", "items", "totals"}
        client_section = next(
            section for section in sections if section["key"] == "client"
        )
        client_section.update({"grid_row": 1, "row_span": 6})
        item_section = next(section for section in sections if section["key"] == "items")
        item_section.update({
            "grid_row": 8,
            "row_span": 3,
            "grid_column": 1,
            "column_span": 12,
        })
        totals = next(section for section in sections if section["key"] == "totals")
        totals.update({"grid_row": 11, "row_span": 8})
        quotation.template_snapshot = {
            "name": "Prueba de paginación",
            "sections": sections,
            "layout": layout,
            "images": [],
        }

        chunks = split_items_for_section(
            quotation,
            item_section,
            styles_for(False),
            width=180 * mm,
            layout=layout,
        )
        pages = standard_pages(
            quotation,
            sections,
            styles_for(False),
            width=180 * mm,
            layout=layout,
            image_paths={},
            frame_height=(279 - 9 - 12) * mm,
        )
        document = quotation_pdf(quotation, "standard")
        page_count = len(re.findall(rb"/Type\s*/Page\b", document))

        self.assertEqual([len(chunk) for chunk in chunks], [1, 1, 1, 1, 1])
        self.assertEqual([len(page_rows) for _, page_rows in pages], [4, 1])
        self.assertIn("client", [section["key"] for section in pages[0][0]])
        self.assertNotIn("client", [section["key"] for section in pages[1][0]])
        self.assertIn("totals", [section["key"] for section in pages[1][0]])
        self.assertEqual(page_count, 2)

    def test_more_than_ten_products_use_the_first_page_and_finish_in_two_pages(self):
        payload = self.payload()
        payload["items"] = [
            {
                "product": self.product.id,
                "quantity": 1,
                "unit_price": "20.00",
            }
            for _ in range(18)
        ]
        response = self.client.post("/api/v1/quotations/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        quotation = Quotation.objects.prefetch_related("items").get(pk=response.data["id"])
        layout = default_template_layout()
        layout["header_height_mm"] = 66
        sections = normalized_template_sections(default_template_sections())
        positions = {
            "client": (1, 10),
            "items": (11, 32),
            "totals": (44, 8),
            "bank_details": (83, 10),
            "commercial_terms": (95, 7),
        }
        for section in sections:
            section["visible"] = section["key"] in positions
            if section["key"] in positions:
                section["grid_row"], section["row_span"] = positions[section["key"]]
        quotation.template_snapshot = {
            "name": "Prueba compacta de 18 productos",
            "sections": sections,
            "layout": layout,
            "images": [],
        }
        visible_sections = [
            section
            for section in sections
            if section["visible"] and section["key"] != "company"
        ]

        pages = standard_pages(
            quotation,
            visible_sections,
            styles_for(False),
            width=180 * mm,
            layout=layout,
            image_paths={},
            frame_height=(279 - 9 - 12) * mm - 12,
        )
        document = quotation_pdf(quotation, "standard")
        page_count = len(re.findall(rb"/Type\s*/Page\b", document))

        self.assertEqual(len(pages), 2)
        self.assertGreaterEqual(len(pages[0][1]), 10)
        self.assertEqual(sum(len(page_rows) for _, page_rows in pages), 18)
        self.assertIn("client", [section["key"] for section in pages[0][0]])
        self.assertNotIn("client", [section["key"] for section in pages[1][0]])
        self.assertEqual(page_count, 2)

    def test_new_quotation_is_pending_when_status_is_omitted(self):
        payload = self.payload()
        payload.pop("status")

        response = self.client.post("/api/v1/quotations/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], Quotation.Status.PENDING)

    def test_quotation_date_defaults_to_today_and_accepts_a_selected_date(self):
        automatic = self.client.post(
            "/api/v1/quotations/", self.payload(), format="json"
        )
        selected_payload = self.payload()
        selected_payload["quotation_date"] = "2026-07-15"
        selected = self.client.post(
            "/api/v1/quotations/", selected_payload, format="json"
        )

        self.assertEqual(automatic.status_code, status.HTTP_201_CREATED, automatic.data)
        self.assertEqual(automatic.data["quotation_date"], timezone.localdate().isoformat())
        self.assertEqual(selected.status_code, status.HTTP_201_CREATED, selected.data)
        self.assertEqual(selected.data["quotation_date"], "2026-07-15")
        self.assertEqual(
            Quotation.objects.get(pk=selected.data["id"]).quotation_date.isoformat(),
            "2026-07-15",
        )

    def test_quotation_date_error_is_shown_in_spanish(self):
        payload = self.payload()
        payload["quotation_date"] = "fecha-invalida"

        response = self.client.post("/api/v1/quotations/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fecha válida", response.data["quotation_date"][0])

    def test_status_can_be_changed_with_a_partial_update(self):
        created = self.client.post(
            "/api/v1/quotations/",
            self.payload(),
            format="json",
        )

        response = self.client.patch(
            f"/api/v1/quotations/{created.data['id']}/",
            {"status": "paid"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], Quotation.Status.PAID)
        self.assertEqual(response.data["client_name"], self.customer.name)

        response = self.client.patch(
            f"/api/v1/quotations/{created.data['id']}/",
            {"status": "pending"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], Quotation.Status.PENDING)
        self.assertEqual(response.data["client_name"], self.customer.name)

    def test_status_permission_does_not_allow_editing_the_quotation(self):
        created = self.client.post(
            "/api/v1/quotations/",
            self.payload(),
            format="json",
        )
        role = Role.objects.create(name="Estados de cotización", code="QUOTE_STATUS")
        role.permissions.add(
            *Permission.objects.filter(
                content_type__app_label="quotations",
                codename__in=["view_quotation", "change_quotation_status"],
            )
        )
        status_user = get_user_model().objects.create_user(
            username="quotation-status",
            email="quotation-status@example.com",
            password="safe-password",
            role=role,
        )
        self.client.force_authenticate(status_user)

        changed = self.client.patch(
            f"/api/v1/quotations/{created.data['id']}/",
            {"status": "paid"},
            format="json",
        )
        rejected = self.client.patch(
            f"/api/v1/quotations/{created.data['id']}/",
            {"notes": "Edición no permitida"},
            format="json",
        )

        self.assertEqual(changed.status_code, status.HTTP_200_OK)
        self.assertEqual(changed.data["status"], Quotation.Status.PAID)
        self.assertEqual(rejected.status_code, status.HTTP_403_FORBIDDEN)

    def test_dashboard_filters_quotations_by_status(self):
        pending = self.client.post("/api/v1/quotations/", self.payload(), format="json")
        self.assertEqual(pending.status_code, status.HTTP_201_CREATED)
        paid_payload = self.payload()
        paid_payload["status"] = "paid"
        paid = self.client.post(
            "/api/v1/quotations/",
            paid_payload,
            format="json",
        )
        self.assertEqual(paid.status_code, status.HTTP_201_CREATED)

        response = self.client.get(
            "/api/v1/quotations/dashboard/?period=month&status=paid"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["sales"]["day"]["count"], 1)
        self.assertEqual(response.data["sales"]["month"]["total"], "40.00")
        self.assertEqual(response.data["top_products"][0]["sku"], "CAL-10")
        self.assertEqual(response.data["top_products"][0]["quantity"], 2)
        self.assertEqual(
            response.data["top_clients"][0]["client_name"],
            self.customer.name,
        )

    def test_dashboard_uses_its_own_permission(self):
        role = Role.objects.create(name="Solo panel", code="DASHBOARD_ONLY")
        role.permissions.add(
            Permission.objects.get(
                content_type__app_label="quotations",
                codename="view_dashboard",
            )
        )
        dashboard_user = get_user_model().objects.create_user(
            username="dashboard-only",
            email="dashboard-only@example.com",
            password="safe-password",
            role=role,
        )
        self.client.force_authenticate(dashboard_user)
        allowed = self.client.get("/api/v1/quotations/dashboard/?period=month")

        role.permissions.clear()
        role.permissions.add(
            Permission.objects.get(
                content_type__app_label="quotations",
                codename="view_quotation",
            )
        )
        denied = self.client.get("/api/v1/quotations/dashboard/?period=month")

        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_notifications_report_pending_quotations(self):
        pending_payload = self.payload()
        pending_payload["status"] = "pending"
        created = self.client.post(
            "/api/v1/quotations/",
            pending_payload,
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)

        response = self.client.get("/api/v1/notifications/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["items"][0]["id"], "pending-quotations")
        self.assertEqual(
            response.data["items"][0]["path"],
            "/quotations/history?status=pending",
        )

    def test_downloads_dashboard_pdf_and_raw_csv(self):
        created = self.client.post("/api/v1/quotations/", self.payload(), format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)

        pdf = self.client.get("/api/v1/quotations/report-pdf/?period=week")
        csv_report = self.client.get(
            "/api/v1/quotations/report-csv/?period=week"
        )

        self.assertEqual(pdf.status_code, status.HTTP_200_OK)
        self.assertEqual(pdf["Content-Type"], "application/pdf")
        self.assertTrue(pdf.content.startswith(b"%PDF"))
        self.assertEqual(csv_report.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", csv_report["Content-Type"])
        decoded = csv_report.content.decode("utf-8-sig")
        self.assertIn("Número de cotización", decoded)
        self.assertIn("COT-000001", decoded)
        self.assertIn("CAL-10", decoded)

    def test_dashboard_rejects_an_unknown_period(self):
        response = self.client.get(
            "/api/v1/quotations/dashboard/?period=year"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_dashboard_and_downloads_accept_a_custom_date_range(self):
        created = self.client.post("/api/v1/quotations/", self.payload(), format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        today = timezone.now().astimezone(REPORT_TIMEZONE).date().isoformat()
        query = f"period=custom&start_date={today}&end_date={today}"

        dashboard = self.client.get(f"/api/v1/quotations/dashboard/?{query}")
        pdf = self.client.get(f"/api/v1/quotations/report-pdf/?{query}")
        csv_report = self.client.get(f"/api/v1/quotations/report-csv/?{query}")

        self.assertEqual(dashboard.status_code, status.HTTP_200_OK)
        self.assertEqual(dashboard.data["period"]["key"], "custom")
        self.assertEqual(dashboard.data["selected"]["count"], 1)
        self.assertEqual(pdf.status_code, status.HTTP_200_OK)
        self.assertTrue(pdf.content.startswith(b"%PDF"))
        self.assertEqual(csv_report.status_code, status.HTTP_200_OK)
        self.assertIn("COT-000001", csv_report.content.decode("utf-8-sig"))

    def test_dashboard_rejects_a_custom_range_longer_than_one_year(self):
        response = self.client.get(
            "/api/v1/quotations/dashboard/"
            "?period=custom&start_date=2024-01-01&end_date=2026-01-02"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("366", response.data["detail"])

    def test_uses_client_level_price_from_minimum_quantity(self):
        level = self.customer.price_level
        tier = PriceTier.objects.create(price_level=level, minimum_quantity=3)
        ProductPrice.objects.create(
            product=self.product, price_level=level, price_tier=tier,
            minimum_quantity=3, unit_price="15.00",
        )
        payload = self.payload()
        payload["items"][0]["quantity"] = 3
        payload["items"][0]["unit_price"] = "999.00"
        response = self.client.post("/api/v1/quotations/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        item = response.data["items"][0]
        self.assertEqual(item["normal_unit_price"], "20.00")
        self.assertEqual(item["special_unit_price"], "15.00")
        self.assertEqual(item["unit_price"], "15.00")
        self.assertEqual(item["total"], "45.00")

    def test_uses_total_quantity_of_all_products_for_the_price_tier(self):
        level = self.customer.price_level
        tier = PriceTier.objects.create(price_level=level, minimum_quantity=3)
        second_product = Product.objects.create(
            category=self.product.category,
            name="Termotanque",
            sku="TERM-001",
            normal_unit_price="30.00",
        )
        ProductPrice.objects.create(
            product=self.product,
            price_level=level,
            price_tier=tier,
            minimum_quantity=3,
            unit_price="15.00",
        )
        ProductPrice.objects.create(
            product=second_product,
            price_level=level,
            price_tier=tier,
            minimum_quantity=3,
            unit_price="24.00",
        )
        payload = self.payload()
        payload["items"] = [
            {"product": self.product.id, "quantity": 2},
            {"product": second_product.id, "quantity": 1},
        ]

        response = self.client.post(
            "/api/v1/quotations/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        items = {item["sku"]: item for item in response.data["items"]}
        self.assertEqual(items["CAL-10"]["special_unit_price"], "15.00")
        self.assertEqual(items["CAL-10"]["unit_price"], "15.00")
        self.assertEqual(items["CAL-10"]["total"], "30.00")
        self.assertEqual(items["TERM-001"]["special_unit_price"], "24.00")
        self.assertEqual(items["TERM-001"]["unit_price"], "24.00")
        self.assertEqual(items["TERM-001"]["total"], "24.00")
        self.assertEqual(response.data["total"], "54.00")

        payload["items"] = [
            {"product": self.product.id, "quantity": 1},
            {"product": second_product.id, "quantity": 1},
        ]
        updated = self.client.put(
            f"/api/v1/quotations/{response.data['id']}/",
            payload,
            format="json",
        )

        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        updated_items = {item["sku"]: item for item in updated.data["items"]}
        self.assertIsNone(updated_items["CAL-10"]["special_unit_price"])
        self.assertEqual(updated_items["CAL-10"]["unit_price"], "20.00")
        self.assertIsNone(updated_items["TERM-001"]["special_unit_price"])
        self.assertEqual(updated_items["TERM-001"]["unit_price"], "30.00")
        self.assertEqual(updated.data["total"], "50.00")

    def test_quotation_price_endpoint_uses_the_quotation_total_quantity(self):
        level = self.customer.price_level
        tier = PriceTier.objects.create(price_level=level, minimum_quantity=3)
        ProductPrice.objects.create(
            product=self.product,
            price_level=level,
            price_tier=tier,
            minimum_quantity=3,
            unit_price="15.00",
        )
        self.user.role.permissions.add(
            Permission.objects.get(
                content_type__app_label="products",
                codename="view_product",
            )
        )

        response = self.client.get(
            f"/api/v1/catalog/products/{self.product.id}/quotation-price/"
            f"?quantity=2&total_quantity=3&client={self.customer.id}"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["quantity"], 2)
        self.assertEqual(response.data["total_quantity"], 3)
        self.assertEqual(response.data["minimum_quantity"], 3)
        self.assertEqual(response.data["special_unit_price"], Decimal("15.00"))
        self.assertEqual(response.data["final_unit_price"], Decimal("15.00"))

        invalid = self.client.get(
            f"/api/v1/catalog/products/{self.product.id}/quotation-price/"
            f"?quantity=2&total_quantity=1&client={self.customer.id}"
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("no puede ser menor", invalid.data["detail"])

    def test_x1_always_uses_the_normal_product_price(self):
        level = self.customer.price_level
        base_tier = level.tiers.get(minimum_quantity=1)
        # A legacy x1 price must not replace the product's normal sale price.
        ProductPrice.objects.create(
            product=self.product,
            price_level=level,
            price_tier=base_tier,
            minimum_quantity=1,
            unit_price="5.00",
        )
        response = self.client.post("/api/v1/quotations/", self.payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        item = response.data["items"][0]
        self.assertEqual(item["normal_unit_price"], "20.00")
        self.assertIsNone(item["special_unit_price"])
        self.assertEqual(item["unit_price"], "20.00")

    def test_quotation_keeps_a_snapshot_of_its_selected_template(self):
        sections = default_template_sections()
        next(item for item in sections if item["key"] == "bank_details")["content"] = (
            "Banco de prueba - Cuenta 999 - IDESEM S.R.L."
        )
        next(item for item in sections if item["key"] == "totals")["show_savings"] = False
        template = QuotationTemplate.objects.create(
            name="Clientes corporativos",
            sections=sections,
        )
        payload = self.payload()
        payload["template"] = template.id

        response = self.client.post("/api/v1/quotations/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["template"], template.id)
        quotation = Quotation.objects.get(pk=response.data["id"])
        self.assertEqual(quotation.template_snapshot["name"], "Clientes corporativos")
        self.assertIn("Banco de prueba", str(quotation.template_snapshot["sections"]))
        totals = next(
            section
            for section in quotation.template_snapshot["sections"]
            if section["key"] == "totals"
        )
        self.assertFalse(totals["show_savings"])

    def test_custom_header_keeps_logo_company_text_and_document_title(self):
        sections = default_template_sections()
        company = next(item for item in sections if item["key"] == "company")
        company["content"] = "IDESEM Personalizado\nSoluciones industriales"
        layout = default_template_layout()
        layout.update(
            {
                "header_height_mm": 60,
                "header_image_width_mm": 72,
                "header_image_height_mm": 55,
                "header_company_font_size": 17,
                "header_subtitle_font_size": 10,
                "header_document_title": "PROPUESTA COMERCIAL",
                "header_document_title_font_size": 15,
            }
        )
        template = QuotationTemplate.objects.create(
            name="Encabezado personalizado",
            sections=sections,
            layout=layout,
        )
        payload = self.payload()
        payload["template"] = template.id

        response = self.client.post("/api/v1/quotations/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        quotation = Quotation.objects.get(pk=response.data["id"])
        saved_layout = quotation.template_snapshot["layout"]
        self.assertEqual(saved_layout["header_height_mm"], 60)
        self.assertEqual(saved_layout["header_image_width_mm"], 72)
        self.assertEqual(saved_layout["header_image_height_mm"], 55)
        self.assertEqual(saved_layout["header_document_title"], "PROPUESTA COMERCIAL")

        header = standard_header(
            quotation,
            styles_for(False),
            width=180 * mm,
            layout=saved_layout,
            image_paths={},
            sections=[],
        )
        brand = header._cellvalues[0][0]
        brand_text = brand._cellvalues[0][1] if hasattr(brand, "_cellvalues") else brand
        document_title = header._cellvalues[0][1]
        self.assertIn("IDESEM Personalizado", brand_text.text)
        self.assertIn("Soluciones industriales", brand_text.text)
        self.assertIn("PROPUESTA COMERCIAL", document_title.text)

    def test_header_height_stops_before_forcing_static_sections_to_another_page(self):
        response = self.client.post("/api/v1/quotations/", self.payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        quotation = Quotation.objects.prefetch_related("items").get(pk=response.data["id"])
        sections = normalized_template_sections(default_template_sections())
        positions = {
            "client": (16, 8),
            "items": (25, 15),
            "totals": (80, 6),
            "bank_details": (95, 8),
            "commercial_terms": (110, 8),
        }
        for section in sections:
            section["visible"] = section["key"] in positions
            if section["key"] in positions:
                section["grid_row"], section["row_span"] = positions[section["key"]]
        requested_layout = default_template_layout()
        requested_layout.update(
            {
                "header_height_mm": 120,
                "header_image_height_mm": 116,
            }
        )
        maximum = maximum_template_header_height_mm(sections, requested_layout)
        constrained = constrained_template_layout(requested_layout, sections)
        quotation.template_snapshot = {
            "name": "Encabezado sin hoja adicional",
            "sections": sections,
            "layout": requested_layout,
            "images": [],
        }

        document = quotation_pdf(quotation, "standard")
        page_count = len(re.findall(rb"/Type\s*/Page\b", document))

        self.assertLess(maximum, 120)
        self.assertEqual(constrained["header_height_mm"], maximum)
        self.assertEqual(
            constrained["header_image_height_mm"],
            max(8, maximum - 4),
        )
        self.assertEqual(page_count, 1)

    def test_static_final_card_uses_free_space_instead_of_creating_extra_page(self):
        payload = self.payload()
        payload["items"] = [
            {"product": self.product.id, "quantity": quantity}
            for quantity in (1, 2, 3)
        ]
        response = self.client.post("/api/v1/quotations/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        quotation = Quotation.objects.prefetch_related("items").get(pk=response.data["id"])
        sections = normalized_template_sections(default_template_sections())
        positions = {
            "client": (1, 8),
            "commercial_terms": (11, 7),
            "items": (25, 40),
            "totals": (80, 7),
            "bank_details": (108, 7),
            "contact": (130, 7),
        }
        for section in sections:
            section["visible"] = section["key"] in positions or section["key"] == "company"
            if section["key"] in positions:
                section["grid_row"], section["row_span"] = positions[section["key"]]
        quotation.template_snapshot = {
            "name": "Ultima tarjeta en la misma hoja",
            "sections": sections,
            "layout": default_template_layout(),
            "images": [],
        }

        document = quotation_pdf(quotation, "standard")
        page_count = len(re.findall(rb"/Type\s*/Page\b", document))

        self.assertEqual(page_count, 1)
        self.assertEqual(
            next(section for section in sections if section["key"] == "contact")["grid_row"],
            130,
        )

    def test_roll_uses_only_selected_header_image_and_fixed_texts(self):
        response = self.client.post("/api/v1/quotations/", self.payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        quotation = Quotation.objects.get(pk=response.data["id"])
        png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        )
        template = QuotationTemplate.objects.create(name="Rollo con imagen")
        image = template.images.create(
            image=SimpleUploadedFile(
                "roll-header.png",
                png,
                content_type="image/png",
            )
        )

        plain = roll_header(quotation, styles_for(True), 66 * mm)
        with_image = roll_header(
            quotation,
            styles_for(True),
            66 * mm,
            image.image.path,
        )
        plain_content = plain._cellvalues[0][0]
        image_content = with_image._cellvalues[0][0]

        self.assertEqual(type(plain_content[0]).__name__, "Paragraph")
        self.assertIn("IDESEM S.R.L.", plain_content[0].text)
        self.assertEqual(type(image_content[0]).__name__, "Image")
        self.assertIn("COTIZACIÓN", image_content[2].text)

        client_blocks = roll_client_block(
            quotation,
            {"title": "Información del cliente"},
            styles_for(True),
        )
        self.assertEqual([type(block).__name__ for block in client_blocks], ["Paragraph", "Paragraph"])

    def test_totals_respects_the_saved_savings_visibility(self):
        response = self.client.post("/api/v1/quotations/", self.payload(), format="json")
        quotation = Quotation.objects.prefetch_related("items").get(pk=response.data["id"])

        hidden = totals_table(
            quotation,
            {"show_savings": False},
            width=160,
            roll=False,
        )
        visible = totals_table(
            quotation,
            {"show_savings": True},
            width=160,
            roll=False,
        )

        self.assertNotIn("Ahorro", [row[0] for row in hidden._cellvalues])
        self.assertIn("Ahorro", [row[0] for row in visible._cellvalues])

    def test_pdf_cards_do_not_include_the_editor_outline(self):
        section = {
            "key": "custom",
            "title": "Información",
            "background_color": "#FFFFFF",
            "border_color": "#FF0000",
            "border_width": 4,
            "padding_mm": 3,
        }

        card = text_card(
            section,
            "Contenido de prueba",
            styles_for(False),
            width=80 * mm,
            padding=3,
        )

        self.assertEqual(card._linecmds, [])

    def test_template_image_uses_the_available_rectangle_proportionally(self):
        template = QuotationTemplate.objects.create(name="Imagen PDF")
        png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        )
        uploaded = self.client.post(
            "/api/v1/quotations/template-images/",
            {
                "template": template.id,
                "image": SimpleUploadedFile(
                    "cuadrada.png",
                    png,
                    content_type="image/png",
                ),
            },
            format="multipart",
        )
        self.assertEqual(uploaded.status_code, status.HTTP_201_CREATED)
        image = template.images.get()
        section = {
            "key": "qr",
            "title": "QR pagos",
            "type": "image",
            "image_id": image.id,
            "row_span": 37,
            "padding_mm": 3,
            "background_color": "#FFFFFF",
        }
        target_height = section_height(section, {"row_gap_mm": 1})
        fitted_width, fitted_height = fitted_image_size(
            image.image.path,
            68 * mm,
            target_height - 16 * mm,
        )
        card = image_card(
            section,
            {image.id: image.image.path},
            styles_for(False),
            width=74 * mm,
            padding=3,
            target_height=target_height,
        )

        self.assertAlmostEqual(fitted_width, fitted_height)
        self.assertGreater(fitted_height, 45 * mm)
        self.assertEqual(card._linecmds, [])

    def test_hidden_sections_do_not_move_visible_sections(self):
        sections = [
            {
                "key": "client",
                "visible": False,
                "grid_row": 1,
                "grid_column": 1,
                "column_span": 12,
                "row_span": 8,
            },
            {
                "key": "items",
                "visible": True,
                "grid_row": 1,
                "grid_column": 1,
                "column_span": 12,
                "row_span": 12,
            },
        ]

        arranged = arranged_template_sections(sections, 12)

        items = next(section for section in arranged if section["key"] == "items")
        self.assertEqual(items["grid_row"], 1)

    def test_template_accepts_custom_text_sections_and_layout(self):
        sections = default_template_sections() + [
            {
                "key": "text-delivery", "type": "text", "title": "Entrega",
                "content": "Entrega dentro de 48 horas.", "visible": True, "order": 110,
                "width_percent": 70, "min_height_mm": 18,
                "grid_row": 56, "grid_column": 2, "column_span": 1, "row_span": 9,
            }
        ]
        response = self.client.post("/api/v1/quotations/templates/", {
            "name": "Con entrega",
            "sections": sections,
            "layout": {
                "page_width_mm": 200,
                "page_height_mm": 280,
                "roll_width_mm": 75,
                "roll_height_mm": 220,
                "box_padding_mm": 5,
                "header_height_mm": 44,
                "header_image_width_mm": 70,
                "header_image_height_mm": 48,
                "header_company_font_size": 17,
                "header_subtitle_font_size": 10,
                "header_document_title": "PROPUESTA",
                "header_document_title_font_size": 15,
                "columns": 2,
                "column_gap_mm": 6,
                "column_widths": [1, 1.5],
            },
            "is_active": True,
            "is_default": False,
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["layout"]["page_width_mm"], 200)
        self.assertEqual(response.data["layout"]["columns"], 2)
        self.assertEqual(response.data["layout"]["header_height_mm"], 44)
        self.assertEqual(response.data["layout"]["header_image_width_mm"], 70)
        self.assertEqual(response.data["layout"]["header_image_height_mm"], 40)
        self.assertEqual(response.data["layout"]["header_document_title"], "PROPUESTA")
        custom = next(section for section in response.data["sections"] if section["key"] == "text-delivery")
        self.assertEqual(custom["grid_column"], 2)

    def test_only_one_template_is_default_and_it_is_listed_first(self):
        first = self.client.post(
            "/api/v1/quotations/templates/",
            {
                "name": "Plantilla inicial",
                "is_active": False,
                "is_default": True,
            },
            format="json",
        )
        second = self.client.post(
            "/api/v1/quotations/templates/",
            {
                "name": "Plantilla preferida",
                "is_active": True,
                "is_default": False,
            },
            format="json",
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertTrue(first.data["is_active"])
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        selected = self.client.patch(
            f"/api/v1/quotations/templates/{second.data['id']}/",
            {"is_default": True},
            format="json",
        )

        self.assertEqual(selected.status_code, status.HTTP_200_OK)
        self.assertEqual(
            QuotationTemplate.objects.filter(is_default=True).count(),
            1,
        )
        self.assertTrue(
            QuotationTemplate.objects.get(pk=second.data["id"]).is_default
        )
        self.assertFalse(
            QuotationTemplate.objects.get(pk=first.data["id"]).is_default
        )

        listed = self.client.get("/api/v1/quotations/templates/")

        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data[0]["id"], second.data["id"])

    def test_uploads_an_image_for_a_template(self):
        template = QuotationTemplate.objects.create(name="Con imagen")
        png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
        response = self.client.post("/api/v1/quotations/template-images/", {
            "template": template.id,
            "image": SimpleUploadedFile("encabezado.png", png, content_type="image/png"),
        }, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["template"], template.id)
