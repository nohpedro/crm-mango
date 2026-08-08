import django.utils.timezone
from django.db import migrations, models


def copy_creation_date(apps, schema_editor):
    Quotation = apps.get_model("quotations", "Quotation")
    for quotation in Quotation.objects.all().iterator():
        quotation.quotation_date = django.utils.timezone.localtime(
            quotation.created_at
        ).date()
        quotation.save(update_fields=["quotation_date"])


class Migration(migrations.Migration):
    dependencies = [("quotations", "0010_quotation_dashboard_permission")]

    operations = [
        migrations.AddField(
            model_name="quotation",
            name="quotation_date",
            field=models.DateField(null=True),
        ),
        migrations.RunPython(copy_creation_date, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="quotation",
            name="quotation_date",
            field=models.DateField(default=django.utils.timezone.localdate),
        ),
        migrations.AddIndex(
            model_name="quotation",
            index=models.Index(
                fields=["status", "quotation_date"],
                name="quotations__status_137c8f_idx",
            ),
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
                        "view_dashboard",
                        "Puede ver el panel principal y sus reportes",
                    ),
                ],
            },
        ),
    ]
