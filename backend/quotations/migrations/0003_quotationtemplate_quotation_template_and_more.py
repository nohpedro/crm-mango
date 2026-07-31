# Generated manually for quotation templates.
from django.db import migrations, models
import django.db.models.deletion
import quotations.template_defaults


class Migration(migrations.Migration):
    dependencies = [("quotations", "0002_quotationitem_additional_discount_percent_and_more")]

    operations = [
        migrations.CreateModel(
            name="QuotationTemplate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120, unique=True)),
                ("description", models.CharField(blank=True, max_length=300)),
                ("sections", models.JSONField(default=quotations.template_defaults.default_template_sections)),
                ("is_active", models.BooleanField(default=True)),
                ("is_default", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["name"], "verbose_name": "plantilla de cotización", "verbose_name_plural": "plantillas de cotización"},
        ),
        migrations.AddField(
            model_name="quotation",
            name="template",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="quotations", to="quotations.quotationtemplate"),
        ),
        migrations.AddField(
            model_name="quotation",
            name="template_snapshot",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
