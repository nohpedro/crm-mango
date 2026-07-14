import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models

from products.models import Product


class Warehouse(models.Model):
    """
    Almacén o ubicación física donde se guarda inventario.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    name = models.CharField(
        max_length=150,
        unique=True,
        verbose_name="nombre",
    )

    code = models.CharField(
        max_length=40,
        unique=True,
        verbose_name="código",
    )

    description = models.TextField(
        blank=True,
        verbose_name="descripción",
    )

    address = models.CharField(
        max_length=250,
        blank=True,
        verbose_name="dirección",
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name="activo",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="fecha de creación",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="fecha de modificación",
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "almacén"
        verbose_name_plural = "almacenes"

    def save(self, *args, **kwargs):
        self.name = self.name.strip()
        self.code = self.code.strip().upper()

        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.code} - {self.name}"


class Stock(models.Model):
    """
    Existencia actual de un producto dentro de un almacén.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="stocks",
        verbose_name="producto",
    )

    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name="stocks",
        verbose_name="almacén",
    )

    quantity = models.PositiveIntegerField(
        default=0,
        verbose_name="stock físico",
    )

    reserved_quantity = models.PositiveIntegerField(
        default=0,
        verbose_name="stock reservado",
    )

    minimum_stock = models.PositiveIntegerField(
        default=0,
        verbose_name="stock mínimo",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="fecha de actualización",
    )

    class Meta:
        ordering = [
            "warehouse",
            "product",
        ]

        verbose_name = "existencia"
        verbose_name_plural = "existencias"

        constraints = [
            models.UniqueConstraint(
                fields=["product", "warehouse"],
                name="unique_product_stock_per_warehouse",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    quantity__gte=models.F("reserved_quantity")
                ),
                name="reserved_stock_not_greater_than_quantity",
            ),
        ]

        indexes = [
            models.Index(fields=["product", "warehouse"]),
            models.Index(fields=["quantity"]),
            models.Index(fields=["minimum_stock"]),
        ]

    @property
    def available_quantity(self) -> int:
        return self.quantity - self.reserved_quantity

    @property
    def is_below_minimum(self) -> bool:
        return self.available_quantity <= self.minimum_stock

    def clean(self):
        if self.reserved_quantity > self.quantity:
            raise ValidationError(
                {
                    "reserved_quantity": (
                        "El stock reservado no puede superar "
                        "el stock físico."
                    )
                }
            )

    def __str__(self) -> str:
        return (
            f"{self.product} | "
            f"{self.warehouse} | "
            f"Stock: {self.quantity}"
        )


class StockMovement(models.Model):
    """
    Registra cada modificación realizada sobre el inventario.

    quantity_delta:
    - Positivo para entradas.
    - Negativo para salidas.
    - Positivo o negativo para ajustes.
    """

    class MovementType(models.TextChoices):
        ENTRY = "ENTRY", "Entrada"
        EXIT = "EXIT", "Salida"
        ADJUSTMENT = "ADJUSTMENT", "Ajuste"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    stock = models.ForeignKey(
        Stock,
        on_delete=models.PROTECT,
        related_name="movements",
        verbose_name="existencia",
    )

    movement_type = models.CharField(
        max_length=20,
        choices=MovementType.choices,
        verbose_name="tipo de movimiento",
    )

    quantity_delta = models.IntegerField(
        verbose_name="variación de cantidad",
        help_text=(
            "Positivo para entradas y negativo para salidas."
        ),
    )

    previous_quantity = models.PositiveIntegerField(
        verbose_name="cantidad anterior",
    )

    resulting_quantity = models.PositiveIntegerField(
        verbose_name="cantidad resultante",
    )

    reference = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="referencia",
        help_text=(
            "Número de compra, venta, ajuste o documento relacionado."
        ),
    )

    notes = models.TextField(
        blank=True,
        verbose_name="observaciones",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="stock_movements_created",
        verbose_name="registrado por",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="fecha del movimiento",
    )

    class Meta:
        ordering = ["-created_at"]

        verbose_name = "movimiento de inventario"
        verbose_name_plural = "movimientos de inventario"

        constraints = [
            models.CheckConstraint(
                condition=~models.Q(quantity_delta=0),
                name="stock_movement_delta_not_zero",
            ),
        ]

        indexes = [
            models.Index(fields=["stock", "-created_at"]),
            models.Index(fields=["movement_type", "-created_at"]),
            models.Index(fields=["reference"]),
        ]

    def clean(self):
        if self.quantity_delta == 0:
            raise ValidationError(
                {
                    "quantity_delta": (
                        "La variación de stock no puede ser cero."
                    )
                }
            )

        if (
            self.movement_type == self.MovementType.ENTRY
            and self.quantity_delta < 0
        ):
            raise ValidationError(
                {
                    "quantity_delta": (
                        "Una entrada debe tener una cantidad positiva."
                    )
                }
            )

        if (
            self.movement_type == self.MovementType.EXIT
            and self.quantity_delta > 0
        ):
            raise ValidationError(
                {
                    "quantity_delta": (
                        "Una salida debe tener una cantidad negativa."
                    )
                }
            )

        if (
            self.resulting_quantity
            != self.previous_quantity + self.quantity_delta
        ):
            raise ValidationError(
                {
                    "resulting_quantity": (
                        "La cantidad resultante no coincide con "
                        "la cantidad anterior y la variación."
                    )
                }
            )

    def __str__(self) -> str:
        return (
            f"{self.get_movement_type_display()} | "
            f"{self.stock.product} | "
            f"{self.quantity_delta}"
        )