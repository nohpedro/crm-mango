from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("quotations", "0009_quotation_change_status_permission"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="quotation",
            options={
                "ordering": ["-created_at"],
                "permissions": [
                    (
                        "configure_quotation_document",
                        "Puede acceder a la configuración del documento de cotización",
                    ),
                    (
                        "manage_quotation_templates",
                        "Puede administrar las plantillas de cotización",
                    ),
                    (
                        "change_quotation_status",
                        "Puede cambiar el estado de una cotización",
                    ),
                    (
                        "view_dashboard",
                        "Puede ver el panel principal y sus reportes",
                    ),
                ],
            },
        ),
    ]
