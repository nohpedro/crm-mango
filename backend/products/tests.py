from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import serializers
from rest_framework.test import APITestCase
from rest_framework import status

from users.models import User

from .models import Category, Product
from .serializers import ProductImageSerializer


class ProductImageValidationTests(TestCase):
    def test_rejects_unsupported_image_type(self):
        image = SimpleUploadedFile(
            "catalog.gif",
            b"gif-bytes",
            content_type="image/gif",
        )

        with self.assertRaises(serializers.ValidationError):
            ProductImageSerializer().validate_image(image)


    def test_rejects_images_larger_than_five_megabytes(self):
        image = SimpleUploadedFile(
            "catalog.jpg",
            b"x" * (5 * 1024 * 1024 + 1),
            content_type="image/jpeg",
        )

        with self.assertRaises(serializers.ValidationError):
            ProductImageSerializer().validate_image(image)


class ProductRestoreAPITests(APITestCase):
    def test_archived_product_can_be_restored(self):
        admin = User.objects.create_superuser(
            username="catalog-admin",
            email="catalog-admin@example.com",
            password="Password123!",
        )
        category = Category.objects.create(name="General", code="GEN")
        product = Product.objects.create(
            category=category,
            name="Producto archivado",
            sku="ARCH-001",
        )
        product.soft_delete()
        self.client.force_authenticate(admin)

        response = self.client.post(
            f"/api/v1/catalog/products/{product.pk}/restore/",
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        product.refresh_from_db()
        self.assertIsNone(product.deleted_at)
        self.assertTrue(product.is_active)
