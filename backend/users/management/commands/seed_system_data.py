from .seed_demo_users import Command as SeedCommand


class Command(SeedCommand):
    help = (
        "Crea datos iniciales idempotentes: usuarios, roles, niveles de precio, "
        "almacén principal y plantilla de cotización."
    )
