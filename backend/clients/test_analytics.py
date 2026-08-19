from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from products.models import Category, PriceLevel, Product
from quotations.models import Quotation, QuotationItem

from .models import Client


class ClientAnalyticsTests(APITestCase):
    def setUp(self):
        user = get_user_model().objects.create_superuser(
            username="analytics-admin",
            email="analytics@example.com",
            password="safe-password",
        )
        self.client.force_authenticate(user)
        level = PriceLevel.objects.create(name="Minorista", code="MINORISTA")
        self.customer = Client.objects.create(
            name="Cliente analizado",
            tax_id="900001",
            department="La Paz",
            city_zone="Centro",
            whatsapp="70000001",
            client_type="Tienda o comercio",
            price_level=level,
            business_activity="Comercio",
        )
        category = Category.objects.create(name="General", code="GENERAL")
        self.product = Product.objects.create(
            category=category,
            name="Producto frecuente",
            sku="PROD-1",
            normal_unit_price="20.00",
        )
        self.paid = self._quotation(Quotation.Status.PAID, 2)
        self.pending = self._quotation(Quotation.Status.PENDING, 3)

    def _quotation(self, quotation_status, quantity):
        quotation = Quotation.objects.create(
            client=self.customer,
            client_name=self.customer.name,
            client_tax_id=self.customer.tax_id,
            status=quotation_status,
        )
        QuotationItem.objects.create(
            quotation=quotation,
            product=self.product,
            sku=self.product.sku,
            name=self.product.name,
            quantity=quantity,
            normal_unit_price="20.00",
            unit_price="20.00",
        )
        return quotation

    def test_reports_paid_and_pending_activity_separately(self):
        response = self.client.get(
            f"/api/v1/clients/{self.customer.pk}/analytics/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["lifetime"]["paid"]["count"], 1)
        self.assertEqual(response.data["lifetime"]["paid"]["total"], "40.00")
        self.assertEqual(response.data["lifetime"]["pending"]["count"], 1)
        self.assertEqual(response.data["lifetime"]["pending"]["total"], "60.00")
        self.assertEqual(response.data["selected"]["quantity"], 5)
        self.assertEqual(response.data["top_products"][0]["quantity"], 5)
        self.assertEqual(response.data["history"]["count"], 2)

    def test_status_filter_limits_products_totals_and_history(self):
        response = self.client.get(
            f"/api/v1/clients/{self.customer.pk}/analytics/?status=pending"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["selected"]["count"], 1)
        self.assertEqual(response.data["selected"]["total"], "60.00")
        self.assertEqual(response.data["top_products"][0]["quantity"], 3)
        self.assertEqual(response.data["history"]["count"], 1)
        self.assertEqual(
            response.data["history"]["results"][0]["status"],
            Quotation.Status.PENDING,
        )

    def test_rejects_an_incomplete_date_range(self):
        response = self.client.get(
            f"/api/v1/clients/{self.customer.pk}/analytics/?start_date=2026-01-01"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fecha inicial", response.data["detail"])

    def test_downloads_filtered_client_report_and_complete_product_list(self):
        for index in range(12):
            product = Product.objects.create(
                category=self.product.category,
                name=f"Producto adicional {index:02d}",
                sku=f"ADIC-{index:02d}",
                normal_unit_price="10.00",
            )
            QuotationItem.objects.create(
                quotation=self.paid,
                product=product,
                sku=product.sku,
                name=product.name,
                quantity=1,
                normal_unit_price="10.00",
                unit_price="10.00",
            )
        pdf = self.client.get(
            f"/api/v1/clients/{self.customer.pk}/analytics-report-pdf/?status=paid"
        )
        csv_report = self.client.get(
            f"/api/v1/clients/{self.customer.pk}/analytics-report-csv/?status=paid"
        )

        self.assertEqual(pdf.status_code, status.HTTP_200_OK)
        self.assertTrue(pdf.content.startswith(b"%PDF"))
        self.assertEqual(csv_report.status_code, status.HTTP_200_OK)
        content = csv_report.content.decode("utf-8-sig")
        self.assertIn("Cliente analizado", content)
        self.assertIn("Producto frecuente", content)
        self.assertIn("Producto adicional 11", content)
        self.assertIn("Pagadas", content)
        self.assertIn("40.00", content)
