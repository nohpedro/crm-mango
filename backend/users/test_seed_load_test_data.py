from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from inventory.models import Stock, StockMovement, Warehouse
from products.models import Product
from quotations.models import Quotation


class SeedLoadTestDataCommandTests(TestCase):
    def test_creates_minimum_volume_and_is_idempotent(self):
        output = StringIO()
        call_command("seed_load_test_data", stdout=output)

        self.assertEqual(
            Product.objects.count(),
            50,
        )
        self.assertEqual(
            Warehouse.objects.count(),
            10,
        )
        self.assertEqual(
            Stock.objects.count(),
            50,
        )
        self.assertEqual(
            StockMovement.objects.count(),
            50,
        )
        self.assertEqual(
            Quotation.objects.count(),
            50,
        )

        counts = (
            Product.objects.count(),
            Warehouse.objects.count(),
            Stock.objects.count(),
            StockMovement.objects.count(),
            Quotation.objects.count(),
        )
        call_command("seed_load_test_data", stdout=StringIO())
        self.assertEqual(
            counts,
            (
                Product.objects.count(),
                Warehouse.objects.count(),
                Stock.objects.count(),
                StockMovement.objects.count(),
                Quotation.objects.count(),
            ),
        )

    def test_rejects_values_below_manual_test_minimum(self):
        with self.assertRaisesMessage(
            CommandError,
            "La cantidad de productos no puede ser menor a 50.",
        ):
            call_command(
                "seed_load_test_data",
                products=49,
                quotations=50,
                stdout=StringIO(),
            )
