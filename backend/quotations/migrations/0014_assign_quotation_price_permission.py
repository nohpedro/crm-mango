from django.db import migrations


def assign_price_permission(apps, schema_editor):
    ContentType = apps.get_model("contenttypes", "ContentType")
    Permission = apps.get_model("auth", "Permission")
    Role = apps.get_model("users", "Role")

    content_type, _ = ContentType.objects.get_or_create(
        app_label="quotations",
        model="quotation",
    )
    permission, _ = Permission.objects.get_or_create(
        content_type=content_type,
        codename="change_quotation_item_price",
        defaults={
            "name": "Puede editar el precio unitario de los productos en una cotización",
        },
    )
    for role in Role.objects.filter(code__in=["ADMIN", "CJ001"]):
        role.permissions.add(permission)


def unassign_price_permission(apps, schema_editor):
    Permission = apps.get_model("auth", "Permission")
    Role = apps.get_model("users", "Role")
    permission = Permission.objects.filter(
        content_type__app_label="quotations",
        codename="change_quotation_item_price",
    ).first()
    if permission:
        for role in Role.objects.filter(code__in=["ADMIN", "CJ001"]):
            role.permissions.remove(permission)


class Migration(migrations.Migration):
    dependencies = [
        ("quotations", "0013_quotationitem_price_manually_set_and_price_permission"),
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(assign_price_permission, unassign_price_permission),
    ]
