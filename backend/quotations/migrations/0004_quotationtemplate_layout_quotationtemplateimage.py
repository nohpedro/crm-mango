from django.db import migrations, models
import django.db.models.deletion
import quotations.models
import quotations.template_defaults


class Migration(migrations.Migration):
    dependencies = [("quotations", "0003_quotationtemplate_quotation_template_and_more")]

    operations = [
        migrations.AddField(
            model_name="quotationtemplate",
            name="layout",
            field=models.JSONField(default=quotations.template_defaults.default_template_layout),
        ),
        migrations.CreateModel(
            name="QuotationTemplateImage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to=quotations.models.quotation_template_image_path)),
                ("alt_text", models.CharField(blank=True, max_length=160)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("template", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="images", to="quotations.quotationtemplate")),
            ],
            options={"ordering": ["-created_at"], "verbose_name": "imagen de plantilla de cotización", "verbose_name_plural": "imágenes de plantilla de cotización"},
        ),
    ]
