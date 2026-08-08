from django.contrib.auth.models import Permission
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from inventory.models import Warehouse
from products.models import PriceLevel
from users.demo_data import LEGACY_SEED_USERNAMES, ROLE_DEFINITIONS, SEED_USERS
from users.models import Role, User
from quotations.models import QuotationTemplate
from quotations.template_defaults import default_template_sections


class Command(BaseCommand):
    help = "Crea los cuatro usuarios y roles iniciales del CRM."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default="Demo12345!",
            help="Contraseña de las cuentas nuevas (por defecto: Demo12345!).",
        )
        parser.add_argument(
            "--reset-passwords",
            action="store_true",
            help="También cambia la contraseña de las cuentas semilla que ya existan.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        roles = self._seed_roles()
        self._seed_default_quotation_template()
        self._seed_business_defaults()
        removed_users = self._remove_legacy_seed_users()
        created_users = []
        updated_users = []
        password = options["password"]

        for definition in SEED_USERS:
            role = roles[definition["role_code"]]
            defaults = {
                "email": definition["email"],
                "first_name": definition["first_name"],
                "last_name": definition["last_name"],
                "role": role,
                "is_active": True,
                "is_staff": definition.get("is_staff", False),
                "is_superuser": definition.get("is_superuser", False),
            }
            user, created = User.objects.get_or_create(
                username=definition["username"],
                defaults=defaults,
            )
            if created:
                user.set_password(password)
                user.save(update_fields=["password"])
                created_users.append(user.username)
                continue

            seed_managed_identity = (
                not user.email or user.email.endswith("@seed.idesem.local")
            )
            for field, value in defaults.items():
                if field in {"email", "first_name", "last_name"} and not seed_managed_identity:
                    continue
                setattr(user, field, value)
            if options["reset_passwords"]:
                user.set_password(password)
            user.save()
            updated_users.append(user.username)

        self.stdout.write(self.style.SUCCESS("Roles y usuarios principales preparados."))
        if removed_users:
            self.stdout.write(f"Cuentas semilla anteriores retiradas: {removed_users}.")
        if created_users:
            self.stdout.write(
                "Cuentas nuevas: "
                + ", ".join(created_users)
                + f". Contraseña: {password}"
            )
        if updated_users:
            self.stdout.write("Cuentas actualizadas: " + ", ".join(updated_users))
        self.stdout.write(
            "Vuelve a iniciar sesión con una cuenta principal para comprobar su menú y accesos."
        )

    @staticmethod
    def _remove_legacy_seed_users() -> int:
        obsolete = User.objects.filter(username__in=LEGACY_SEED_USERNAMES).filter(
            Q(email__endswith="@seed.idesem.local")
            | Q(username__startswith="demo_", email__endswith="@idesem.local")
        )
        count = obsolete.count()
        obsolete.delete()
        return count

    @staticmethod
    def _seed_business_defaults():
        for name, code, description in (
            (
                "Mayorista",
                "MAYORISTA",
                "Nivel para clientes que compran en cantidades mayores.",
            ),
            (
                "Minorista",
                "MINORISTA",
                "Nivel para ventas regulares o por unidad.",
            ),
            (
                "Preferencial",
                "PREFERENCIAL",
                "Nivel para clientes con condiciones comerciales preferentes.",
            ),
        ):
            level = (
                PriceLevel.objects.filter(name__iexact=name).first()
                or PriceLevel.objects.filter(code__iexact=code).first()
            )
            if level:
                changed_fields = []
                if level.name != name:
                    level.name = name
                    changed_fields.append("name")
                if not level.is_active:
                    level.is_active = True
                    changed_fields.append("is_active")
                if changed_fields:
                    level.save(update_fields=[*changed_fields, "updated_at"])
                continue
            PriceLevel.objects.create(
                name=name,
                code=code,
                description=description,
                is_active=True,
            )

        warehouse = (
            Warehouse.objects.filter(name__iexact="Principal").first()
            or Warehouse.objects.filter(code__iexact="PRINCIPAL").first()
        )
        if warehouse:
            changed_fields = []
            if warehouse.name != "Principal":
                warehouse.name = "Principal"
                changed_fields.append("name")
            if not warehouse.is_active:
                warehouse.is_active = True
                changed_fields.append("is_active")
            if changed_fields:
                warehouse.save(update_fields=[*changed_fields, "updated_at"])
            return
        Warehouse.objects.create(
            name="Principal",
            code="PRINCIPAL",
            description="Almacén principal de IDESEM.",
            is_active=True,
        )

    def _seed_roles(self) -> dict[str, Role]:
        roles: dict[str, Role] = {}
        all_permissions = Permission.objects.filter(
            content_type__app_label__in=[
                "clients",
                "inventory",
                "products",
                "quotations",
                "users",
            ]
        )
        for definition in ROLE_DEFINITIONS:
            role, _ = Role.objects.update_or_create(
                code=definition["code"],
                defaults={
                    "name": definition["name"],
                    "description": definition["description"],
                    "is_active": True,
                },
            )
            permission_codes = definition["permissions"]
            permissions = all_permissions if permission_codes is None else self._permissions(permission_codes)
            role.permissions.set(permissions)
            roles[role.code] = role
        return roles

    @staticmethod
    def _seed_default_quotation_template():
        QuotationTemplate.objects.get_or_create(
            name="Cotización profesional IDESEM",
            defaults={
                "description": "Diseño institucional con datos de pago, condiciones y responsable.",
                "sections": default_template_sections(),
                "is_active": True,
                "is_default": True,
            },
        )

    def _permissions(self, permission_codes: tuple[str, ...]):
        permissions = []
        for permission_code in permission_codes:
            app_label, codename = permission_code.split(".", maxsplit=1)
            permission = Permission.objects.filter(
                content_type__app_label=app_label,
                codename=codename,
            ).first()
            if not permission:
                raise CommandError(f"No existe el permiso configurado: {permission_code}")
            permissions.append(permission)
        return permissions
