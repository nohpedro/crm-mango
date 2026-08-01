from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from clients.models import Client
from products.models import Product
from .template_defaults import default_template_layout, default_template_sections


class QuotationTemplate(models.Model):
    name = models.CharField(max_length=120, unique=True)
    description = models.CharField(max_length=300, blank=True)
    sections = models.JSONField(default=default_template_sections)
    layout = models.JSONField(default=default_template_layout)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_default", "-is_active", "name"]
        verbose_name = "plantilla de cotización"
        verbose_name_plural = "plantillas de cotización"

    def __str__(self):
        return self.name


def quotation_template_image_path(instance, filename):
    return f"quotation-templates/{instance.template_id}/{filename}"


class QuotationTemplateImage(models.Model):
    template = models.ForeignKey(QuotationTemplate, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to=quotation_template_image_path)
    alt_text = models.CharField(max_length=160, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "imagen de plantilla de cotización"
        verbose_name_plural = "imágenes de plantilla de cotización"


class Quotation(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente"
        PAID = "paid", "Pagada"

    number = models.CharField(max_length=24, unique=True, editable=False)
    client = models.ForeignKey(
        Client, null=True, blank=True, on_delete=models.SET_NULL, related_name="quotations"
    )
    client_name = models.CharField(max_length=200)
    client_tax_id = models.CharField(max_length=30, blank=True)
    client_phone = models.CharField(max_length=30, blank=True)
    client_address = models.CharField(max_length=200, blank=True)
    template = models.ForeignKey(
        QuotationTemplate,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="quotations",
    )
    template_snapshot = models.JSONField(default=dict, blank=True)
    valid_days = models.PositiveSmallIntegerField(default=7, validators=[MinValueValidator(1)])
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="quotations_created"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["number"]), models.Index(fields=["status", "created_at"])]
        permissions = [
            (
                "configure_quotation_document",
                "Puede acceder a la configuración del documento de cotización",
            ),
            (
                "manage_quotation_templates",
                "Puede administrar las plantillas de cotización",
            ),
        ]

    def save(self, *args, **kwargs):
        for field in ("client_name", "client_tax_id", "client_phone", "client_address", "notes"):
            setattr(self, field, (getattr(self, field) or "").strip())
        super().save(*args, **kwargs)
        if not self.number:
            self.number = f"COT-{self.pk:06d}"
            type(self).objects.filter(pk=self.pk).update(number=self.number)

    @property
    def total(self):
        return sum((item.total for item in self.items.all()), Decimal("0.00"))


class QuotationItem(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, null=True, blank=True, on_delete=models.SET_NULL, related_name="quotation_items")
    sku = models.CharField(max_length=80, blank=True)
    name = models.CharField(max_length=200)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    normal_unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    special_unit_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    applied_price_level = models.CharField(max_length=100, blank=True)
    additional_discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])

    class Meta:
        ordering = ["id"]

    @property
    def total(self):
        return self.quantity * self.unit_price

    @property
    def savings(self):
        return (self.normal_unit_price - self.unit_price) * self.quantity
