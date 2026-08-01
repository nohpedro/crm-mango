from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("quotations", "0007_simplify_quotation_status"),
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
                ],
            },
        ),
    ]
