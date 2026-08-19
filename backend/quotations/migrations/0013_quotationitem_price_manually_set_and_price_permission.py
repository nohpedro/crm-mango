from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("quotations", "0012_quotationitem_serial_numbers"),
    ]

    operations = [
        migrations.AddField(
            model_name="quotationitem",
            name="price_manually_set",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterModelOptions(
            name="quotation",
            options={
                "ordering": ["-quotation_date", "-created_at"],
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
                        "change_quotation_item_price",
                        "Puede editar el precio unitario de los productos en una cotización",
                    ),
                    (
                        "view_dashboard",
                        "Puede ver el panel principal y sus reportes",
                    ),
                ],
            },
        ),
    ]
