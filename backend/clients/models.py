from django.db import models

from products.models import PriceLevel


class Client(models.Model):
    class ClientType(models.TextChoices):
        DISTRIBUTOR = "Distribuidor o mayorista", "Distribuidor o mayorista"
        STORE = "Tienda o comercio", "Tienda o comercio"
        TECHNICIAN = "Técnico o instalador", "Técnico o instalador"
        COMPANY = "Empresa o constructora", "Empresa o constructora"
        INSTITUTION = "Institución o proyecto", "Institución o proyecto"

    name = models.CharField(max_length=200, verbose_name="nombre o razón social")
    tax_id = models.CharField(max_length=30, unique=True, verbose_name="NIT/CI")
    department = models.CharField(max_length=80, verbose_name="departamento")
    city_zone = models.CharField(max_length=120, verbose_name="ciudad/zona")
    whatsapp = models.CharField(max_length=30, verbose_name="WhatsApp")
    client_type = models.CharField(max_length=80)
    price_level = models.ForeignKey(
        PriceLevel,
        on_delete=models.PROTECT,
        related_name="clients",
        verbose_name="nivel de precio",
    )
    business_activity = models.CharField(max_length=200, verbose_name="rubro o actividad")
    observations = models.TextField(blank=True, verbose_name="observaciones")
    is_active = models.BooleanField(default=True, verbose_name="activo")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "cliente"
        verbose_name_plural = "clientes"
        indexes = [
            models.Index(fields=["department"]),
            models.Index(fields=["client_type"]),
            models.Index(fields=["is_active"]),
        ]

    def save(self, *args, **kwargs):
        for field in (
            "name",
            "tax_id",
            "department",
            "city_zone",
            "whatsapp",
            "business_activity",
            "observations",
        ):
            setattr(self, field, (getattr(self, field) or "").strip())
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.tax_id})"


class ClientType(models.Model):
    name = models.CharField(max_length=80, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "tipo de cliente"
        verbose_name_plural = "tipos de cliente"

    def __str__(self):
        return self.name
