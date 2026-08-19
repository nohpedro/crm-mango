from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("quotations", "0011_quotation_date")]

    operations = [
        migrations.AddField(
            model_name="quotationitem",
            name="serial_numbers",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
