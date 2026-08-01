from django.db import migrations, models


def migrate_existing_statuses(apps, schema_editor):
    Quotation = apps.get_model("quotations", "Quotation")
    Quotation.objects.exclude(status="paid").update(status="pending")


class Migration(migrations.Migration):
    dependencies = [
        ("quotations", "0006_alter_quotationtemplate_options"),
    ]

    operations = [
        migrations.RunPython(migrate_existing_statuses, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="quotation",
            name="status",
            field=models.CharField(
                choices=[("pending", "Pendiente"), ("paid", "Pagada")],
                default="pending",
                max_length=12,
            ),
        ),
    ]
