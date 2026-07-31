import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


def product_image_upload_path(instance, filename: str) -> str:
    """
    Genera una ruta organizada para las imágenes de productos.
    """

    product_id = instance.product_id or "temporary"

    return f"products/{product_id}/{filename}"


class Category(models.Model):
    """
    Categoría comercial utilizada para agrupar productos.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    name = models.CharField(
        max_length=120,
        unique=True,
        verbose_name="nombre",
    )

    code = models.CharField(
        max_length=40,
        unique=True,
        verbose_name="código",
        help_text="Ejemplo: CALEFONES, CALEFACTORES.",
    )

    description = models.TextField(
        blank=True,
        verbose_name="descripción",
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name="activa",
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
        verbose_name = "categoría"
        verbose_name_plural = "categorías"

    def save(self, *args, **kwargs):
        self.name = self.name.strip()
        self.code = self.code.strip().upper()

        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class PriceLevel(models.Model):
    """
    Nivel comercial utilizado para determinar los precios.

    Ejemplos:
    - Mayorista
    - Preferencial
    - Regular
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="nombre",
    )

    code = models.CharField(
        max_length=40,
        unique=True,
        verbose_name="código",
        help_text="Ejemplo: WHOLESALE, PREFERRED, REGULAR.",
    )

    description = models.TextField(
        blank=True,
        verbose_name="descripción",
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
        verbose_name = "nivel de precio"
        verbose_name_plural = "niveles de precio"

    def save(self, *args, **kwargs):
        self.name = self.name.strip()
        self.code = self.code.strip().upper()

        super().save(*args, **kwargs)
        PriceTier.objects.get_or_create(price_level=self, minimum_quantity=1)

    def __str__(self) -> str:
        return self.name


class PriceTier(models.Model):
    """Escalón de cantidad de un tipo de precio (x1, x3, x6, etc.)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    price_level = models.ForeignKey(PriceLevel, on_delete=models.CASCADE, related_name="tiers")
    minimum_quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["price_level__name", "minimum_quantity"]
        constraints = [models.UniqueConstraint(fields=["price_level", "minimum_quantity"], name="unique_price_tier_quantity")]

    @property
    def label(self):
        return f"{self.price_level.name} x{self.minimum_quantity}"

    def __str__(self):
        return self.label


class Product(models.Model):
    """
    Producto perteneciente al catálogo comercial.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
        verbose_name="categoría",
    )

    name = models.CharField(
        max_length=200,
        verbose_name="nombre",
    )

    sku = models.CharField(
        max_length=80,
        unique=True,
        verbose_name="SKU",
        help_text="Código interno único del producto.",
    )

    barcode = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        verbose_name="código de barras",
    )

    description = models.TextField(
        blank=True,
        verbose_name="descripción",
    )

    normal_unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name="precio de venta normal",
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name="activo",
    )

    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="fecha de eliminación",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="products_created",
        verbose_name="creado por",
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="products_updated",
        verbose_name="modificado por",
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
        ordering = ["name", "sku"]
        verbose_name = "producto"
        verbose_name_plural = "productos"

        constraints = [
            models.UniqueConstraint(
                fields=["category", "name"],
                name="unique_product_name_per_category",
            ),
        ]

        indexes = [
            models.Index(fields=["sku"]),
            models.Index(fields=["name"]),
            models.Index(fields=["category", "is_active"]),
            models.Index(fields=["deleted_at"]),
        ]

    def save(self, *args, **kwargs):
        self.name = self.name.strip()
        self.sku = self.sku.strip().upper()

        if self.barcode:
            self.barcode = self.barcode.strip()
        else:
            self.barcode = None

        super().save(*args, **kwargs)

    def soft_delete(self):
        """
        Elimina lógicamente el producto sin borrar su historial.
        """

        self.is_active = False
        self.deleted_at = timezone.now()

        self.save(
            update_fields=[
                "is_active",
                "deleted_at",
                "updated_at",
            ]
        )

    def restore(self):
        """
        Restaura un producto eliminado lógicamente.
        """

        self.is_active = True
        self.deleted_at = None

        self.save(
            update_fields=[
                "is_active",
                "deleted_at",
                "updated_at",
            ]
        )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def __str__(self) -> str:
        return f"{self.sku} - {self.name}"


class ProductImage(models.Model):
    """
    Imagen asociada con un producto.

    Un producto puede tener varias imágenes y una imagen principal.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="images",
        verbose_name="producto",
    )

    image = models.ImageField(
        upload_to=product_image_upload_path,
        verbose_name="imagen",
    )

    alt_text = models.CharField(
        max_length=200,
        blank=True,
        verbose_name="texto alternativo",
    )

    is_primary = models.BooleanField(
        default=False,
        verbose_name="imagen principal",
    )

    position = models.PositiveIntegerField(
        default=0,
        verbose_name="posición",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="fecha de creación",
    )

    class Meta:
        ordering = [
            "-is_primary",
            "position",
            "created_at",
        ]

        verbose_name = "imagen del producto"
        verbose_name_plural = "imágenes de productos"

        indexes = [
            models.Index(fields=["product", "is_primary"]),
        ]

    def __str__(self) -> str:
        return f"Imagen de {self.product}"


class ProductPrice(models.Model):
    """
    Precio de un producto según nivel comercial y cantidad mínima.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="prices",
        verbose_name="producto",
    )

    price_level = models.ForeignKey(
        PriceLevel,
        on_delete=models.PROTECT,
        related_name="product_prices",
        verbose_name="nivel de precio",
    )

    price_tier = models.ForeignKey(
        PriceTier,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="product_prices",
        verbose_name="nivel por cantidad",
    )

    minimum_quantity = models.PositiveIntegerField(
        validators=[
            MinValueValidator(1),
        ],
        verbose_name="cantidad mínima",
    )

    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(0),
        ],
        verbose_name="precio unitario",
    )

    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name="descuento informativo (%)",
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name="activo",
    )

    valid_from = models.DateTimeField(
        default=timezone.now,
        verbose_name="válido desde",
    )

    valid_until = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="válido hasta",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="product_prices_created",
        verbose_name="creado por",
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
        ordering = [
            "product",
            "price_level",
            "minimum_quantity",
        ]

        verbose_name = "precio de producto"
        verbose_name_plural = "precios de productos"

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "product",
                    "price_level",
                    "minimum_quantity",
                ],
                name="unique_product_level_quantity_price",
            ),
        ]

        indexes = [
            models.Index(
                fields=[
                    "product",
                    "price_level",
                    "minimum_quantity",
                ]
            ),
            models.Index(fields=["is_active", "valid_from"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.product} | "
            f"{self.price_level} | "
            f"Desde {self.minimum_quantity}: "
            f"Bs {self.unit_price}"
        )
