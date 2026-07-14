import uuid

from django.contrib.auth.models import (
    AbstractUser,
    Permission,
)
from django.db import models

from .managers import UserManager


class Role(models.Model):
    """
    Rol funcional asignado a los usuarios del CRM.

    Ejemplos:
    - Administrador
    - Comercial
    - Catálogo
    - Consulta
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
        max_length=50,
        unique=True,
        verbose_name="código",
        help_text=(
            "Código interno del rol. "
            "Ejemplos: ADMIN, SALES, CATALOG, VIEWER."
        ),
    )

    description = models.TextField(
        blank=True,
        verbose_name="descripción",
    )

    permissions = models.ManyToManyField(
        Permission,
        blank=True,
        related_name="crm_roles",
        verbose_name="permisos",
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
        verbose_name = "rol"
        verbose_name_plural = "roles"

    def save(self, *args, **kwargs):
        self.name = self.name.strip()
        self.code = self.code.strip().upper()

        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class User(AbstractUser):
    """
    Usuario personalizado del CRM IDESEM.

    Utiliza el correo electrónico como credencial principal.
    También conserva un nombre de usuario único.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    username = models.CharField(
        max_length=150,
        unique=True,
        verbose_name="nombre de usuario",
    )

    email = models.EmailField(
        unique=True,
        verbose_name="correo electrónico",
    )

    role = models.ForeignKey(
        Role,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="users",
        verbose_name="rol",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="fecha de creación",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="fecha de modificación",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    objects = UserManager()

    class Meta:
        ordering = [
            "first_name",
            "last_name",
            "email",
        ]

        verbose_name = "usuario"
        verbose_name_plural = "usuarios"

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        self.username = self.username.strip()

        super().save(*args, **kwargs)

    def __str__(self) -> str:
        full_name = self.get_full_name().strip()

        if full_name:
            return f"{full_name} — {self.email}"

        return self.email