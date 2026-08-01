from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from clients.models import Client, ClientType
from inventory.models import Stock, StockMovement, Warehouse
from products.models import (
    Category,
    PriceLevel,
    PriceTier,
    Product,
    ProductPrice,
)
from quotations.models import Quotation, QuotationTemplate
from quotations.serializers import QuotationSerializer
from users.models import User


MINIMUM_PRODUCTS = 50
MINIMUM_QUOTATIONS = 50
WAREHOUSE_COUNT = 10
CLIENT_COUNT = 12
CATEGORY_COUNT = 5
DATA_PREFIX = "CARGA-QA"


class Command(BaseCommand):
    help = (
        "Crea datos idempotentes de carga para pruebas manuales: al menos "
        "50 productos, una existencia y un movimiento por producto, "
        "50 cotizaciones y 10 almacenes."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--products",
            type=int,
            default=MINIMUM_PRODUCTS,
            help="Productos de carga que se prepararán (mínimo 50).",
        )
        parser.add_argument(
            "--quotations",
            type=int,
            default=MINIMUM_QUOTATIONS,
            help="Cotizaciones de carga que se prepararán (mínimo 50).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        product_count = options["products"]
        quotation_count = options["quotations"]
        if product_count < MINIMUM_PRODUCTS:
            raise CommandError("La cantidad de productos no puede ser menor a 50.")
        if quotation_count < MINIMUM_QUOTATIONS:
            raise CommandError("La cantidad de cotizaciones no puede ser menor a 50.")

        actor = (
            User.objects.filter(username="demo_admin", is_active=True).first()
            or User.objects.filter(is_superuser=True, is_active=True).first()
        )
        level, tier = self._prepare_price_level()
        categories = self._prepare_categories()
        warehouses = self._prepare_warehouses()
        clients = self._prepare_clients(level)
        products = self._prepare_products(
            product_count,
            categories,
            level,
            tier,
            actor,
        )
        stocks = self._prepare_inventory(
            products,
            warehouses,
            actor,
            product_count,
        )
        quotations = self._prepare_quotations(
            quotation_count,
            products,
            clients,
            actor,
        )

        self.stdout.write(self.style.SUCCESS("Datos de carga preparados correctamente."))
        self.stdout.write(
            f"Productos disponibles: {Product.objects.filter(deleted_at__isnull=True).count()} | "
            f"Existencias: {len(stocks)} | "
            f"Movimientos: {StockMovement.objects.count()}"
        )
        self.stdout.write(
            f"Cotizaciones disponibles: {len(quotations)} | "
            f"Almacenes disponibles: {len(warehouses)} | "
            f"Clientes auxiliares: {len(clients)}"
        )
        self.stdout.write(
            "Busca el prefijo CARGA-QA en productos, referencias y observaciones "
            "para identificar estos registros."
        )

    @staticmethod
    def _prepare_price_level():
        level = (
            PriceLevel.objects.filter(name__iexact="Preferencial").first()
            or PriceLevel.objects.create(
                name="Preferencial",
                code="PREFERENCIAL",
                description="Nivel preferencial para pruebas de precio por cantidad.",
                is_active=True,
            )
        )
        changed_fields = []
        if not level.is_active:
            level.is_active = True
            changed_fields.append("is_active")
        if changed_fields:
            level.save(update_fields=[*changed_fields, "updated_at"])
        tier, _ = PriceTier.objects.update_or_create(
            price_level=level,
            minimum_quantity=3,
            defaults={"is_active": True},
        )
        return level, tier

    @staticmethod
    def _prepare_categories():
        labels = (
            "Herramientas",
            "Electricidad",
            "Calefacción",
            "Seguridad",
            "Accesorios",
        )
        categories = []
        for index in range(1, CATEGORY_COUNT + 1):
            category, _ = Category.objects.update_or_create(
                code=f"{DATA_PREFIX}-CAT-{index:02d}",
                defaults={
                    "name": f"Carga QA · {labels[index - 1]}",
                    "description": (
                        "Categoría generada para pruebas manuales de carga, "
                        "búsqueda y paginación."
                    ),
                    "is_active": True,
                },
            )
            categories.append(category)
        return categories

    @staticmethod
    def _prepare_warehouses():
        locations = (
            "Central",
            "Norte",
            "Sur",
            "Este",
            "Oeste",
            "Sucursal 1",
            "Sucursal 2",
            "Tránsito",
            "Reserva",
            "Exhibición",
        )
        index = 1
        while Warehouse.objects.count() < WAREHOUSE_COUNT:
            location = locations[(index - 1) % len(locations)]
            warehouse, _ = Warehouse.objects.update_or_create(
                code=f"{DATA_PREFIX}-ALM-{index:02d}",
                defaults={
                    "name": f"Almacén carga QA {index:02d} · {location}",
                    "description": (
                        "Almacén generado para pruebas manuales de inventario."
                    ),
                    "address": f"Zona de pruebas {index:02d}, Potosí",
                    "is_active": True,
                },
            )
            index += 1
        return list(Warehouse.objects.filter(is_active=True).order_by("code"))

    @staticmethod
    def _prepare_clients(level):
        ClientType.objects.update_or_create(
            name="Cliente de carga QA",
            defaults={"is_active": True},
        )
        clients = []
        for index in range(1, CLIENT_COUNT + 1):
            client, _ = Client.objects.update_or_create(
                tax_id=f"CARGAQA-{index:06d}",
                defaults={
                    "name": f"Cliente carga QA {index:02d} S.R.L.",
                    "department": (
                        "Potosí" if index % 3 == 1 else "La Paz" if index % 3 == 2 else "Cochabamba"
                    ),
                    "city_zone": f"Zona comercial {index:02d}",
                    "whatsapp": f"7000{index:04d}",
                    "client_type": "Cliente de carga QA",
                    "price_level": level,
                    "business_activity": (
                        "Construcción"
                        if index % 3 == 1
                        else "Distribución"
                        if index % 3 == 2
                        else "Servicios técnicos"
                    ),
                    "observations": (
                        f"{DATA_PREFIX} · Cliente auxiliar para pruebas manuales."
                    ),
                    "is_active": True,
                },
            )
            clients.append(client)
        return clients

    @staticmethod
    def _prepare_products(count, categories, level, tier, actor):
        product_names = (
            "Taladro industrial",
            "Sierra circular",
            "Calefón instantáneo",
            "Kit de instalación",
            "Válvula reforzada",
            "Sensor térmico",
            "Cable eléctrico",
            "Interruptor",
            "Guante de seguridad",
            "Juego de herramientas",
        )
        index = 1
        while Product.objects.filter(deleted_at__isnull=True).count() < count:
            normal_price = Decimal(25 + ((index * 17) % 475)).quantize(
                Decimal("0.01")
            )
            product, _ = Product.objects.update_or_create(
                sku=f"{DATA_PREFIX}-PROD-{index:04d}",
                defaults={
                    "category": categories[(index - 1) % len(categories)],
                    "name": (
                        f"{product_names[(index - 1) % len(product_names)]} "
                        f"· Carga {index:03d}"
                    ),
                    "barcode": f"779000{index:07d}",
                    "description": (
                        f"{DATA_PREFIX} · Producto {index:03d} preparado para "
                        "probar búsquedas, filtros, paginación, precios e inventario."
                    ),
                    "normal_unit_price": normal_price,
                    "is_active": True,
                    "deleted_at": None,
                    "created_by": actor,
                },
            )
            discount = Decimal(10 + (index % 11))
            special_price = (
                normal_price * (Decimal("100") - discount) / Decimal("100")
            ).quantize(Decimal("0.01"))
            ProductPrice.objects.update_or_create(
                product=product,
                price_level=level,
                minimum_quantity=tier.minimum_quantity,
                defaults={
                    "price_tier": tier,
                    "unit_price": special_price,
                    "discount_percent": discount,
                    "is_active": True,
                    "valid_until": None,
                    "created_by": actor,
                },
            )
            index += 1
        load_products = list(
            Product.objects.filter(
                sku__startswith=f"{DATA_PREFIX}-PROD-",
                is_active=True,
                deleted_at__isnull=True,
            ).order_by("sku")
        )
        return load_products or list(
            Product.objects.filter(
                is_active=True,
                deleted_at__isnull=True,
            ).order_by("sku")
        )

    @staticmethod
    def _prepare_inventory(products, warehouses, actor, target_count):
        now = timezone.now()
        all_products = list(
            Product.objects.filter(
                is_active=True,
                deleted_at__isnull=True,
            ).order_by("sku")
        )
        pair_index = 0
        max_pairs = len(all_products) * len(warehouses)
        while Stock.objects.count() < target_count:
            if pair_index >= max_pairs:
                raise CommandError(
                    "No existen suficientes combinaciones de producto y almacén "
                    "para crear 50 existencias."
                )
            product = all_products[pair_index % len(all_products)]
            warehouse = warehouses[
                (pair_index // len(all_products)) % len(warehouses)
            ]
            Stock.objects.get_or_create(
                product=product,
                warehouse=warehouse,
                defaults={"minimum_stock": 1 + (pair_index % 10)},
            )
            pair_index += 1

        load_stocks = list(
            Stock.objects.filter(
                product__sku__startswith=f"{DATA_PREFIX}-PROD-"
            )
            .select_related("product", "warehouse")
            .order_by("product__sku", "warehouse__code")
        )
        movement_index = 1
        while StockMovement.objects.count() < target_count:
            stock = load_stocks[(movement_index - 1) % len(load_stocks)]
            reference = f"{DATA_PREFIX}-INV-{movement_index:04d}"
            movement = StockMovement.objects.filter(reference=reference).first()
            if not movement:
                quantity = 25 + ((movement_index * 19) % 476)
                previous = stock.quantity
                stock.quantity = previous + quantity
                stock.save(update_fields=["quantity", "updated_at"])
                movement = StockMovement.objects.create(
                    stock=stock,
                    movement_type=StockMovement.MovementType.ENTRY,
                    quantity_delta=quantity,
                    previous_quantity=previous,
                    resulting_quantity=stock.quantity,
                    reference=reference,
                    notes=(
                        f"{DATA_PREFIX} · Entrada inicial para pruebas manuales."
                    ),
                    created_by=actor,
                )
                StockMovement.objects.filter(pk=movement.pk).update(
                    created_at=now - timedelta(days=movement_index % 60)
                )
            movement_index += 1
        return list(Stock.objects.all())

    @staticmethod
    def _prepare_quotations(count, products, clients, actor):
        now = timezone.now()
        template = (
            QuotationTemplate.objects.filter(is_default=True, is_active=True).first()
            or QuotationTemplate.objects.filter(is_active=True).first()
        )
        index = 1
        while Quotation.objects.count() < count:
            marker = f"{DATA_PREFIX}-COT-{index:04d}"
            quotation = Quotation.objects.filter(notes__startswith=marker).first()
            if not quotation:
                client = clients[(index - 1) % len(clients)]
                item_count = 1 + ((index - 1) % 8)
                items = []
                for offset in range(item_count):
                    product = products[(index * 3 + offset * 7) % len(products)]
                    quantity = 1 + ((index + offset * 2) % 12)
                    items.append(
                        {
                            "product": str(product.id),
                            "quantity": quantity,
                        }
                    )
                serializer = QuotationSerializer(
                    data={
                        "client": client.pk,
                        "client_name": client.name,
                        "client_tax_id": client.tax_id,
                        "client_phone": client.whatsapp,
                        "client_address": (
                            f"{client.city_zone}, {client.department}"
                        ),
                        "template": template.pk if template else None,
                        "valid_days": 7 + (index % 24),
                        "notes": (
                            f"{marker} | Cotización generada para pruebas "
                            "manuales de volumen y reportes."
                        ),
                        "status": Quotation.Status.PENDING,
                        "items": items,
                    }
                )
                serializer.is_valid(raise_exception=True)
                quotation = serializer.save(created_by=actor)
                Quotation.objects.filter(pk=quotation.pk).update(
                    created_at=now - timedelta(days=(index * 3) % 120),
                    updated_at=now - timedelta(days=(index * 3) % 120),
                )
                quotation.refresh_from_db()
            index += 1
        return list(Quotation.objects.all())
