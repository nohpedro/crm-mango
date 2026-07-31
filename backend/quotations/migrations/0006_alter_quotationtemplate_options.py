from django.db import migrations


def keep_only_one_default_template(apps, schema_editor):
    QuotationTemplate = apps.get_model("quotations", "QuotationTemplate")
    defaults = list(
        QuotationTemplate.objects.filter(is_default=True)
        .order_by("-updated_at", "pk")
        .values_list("pk", flat=True)
    )
    if len(defaults) > 1:
        QuotationTemplate.objects.filter(pk__in=defaults[1:]).update(
            is_default=False
        )


class Migration(migrations.Migration):
    dependencies = [
        ("quotations", "0005_alter_quotation_status"),
    ]

    operations = [
        migrations.RunPython(
            keep_only_one_default_template,
            migrations.RunPython.noop,
        ),
        migrations.AlterModelOptions(
            name="quotationtemplate",
            options={
                "ordering": ["-is_default", "-is_active", "name"],
                "verbose_name": "plantilla de cotización",
                "verbose_name_plural": "plantillas de cotización",
            },
        ),
    ]
