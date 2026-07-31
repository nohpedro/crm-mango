from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("quotations", "0004_quotationtemplate_layout_quotationtemplateimage"),
    ]

    operations = [
        migrations.AlterField(
            model_name="quotation",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "Borrador"),
                    ("issued", "Emitida"),
                    ("cancelled", "Anulada"),
                ],
                default="issued",
                max_length=12,
            ),
        ),
    ]
