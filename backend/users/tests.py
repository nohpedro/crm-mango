from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Role, User


class AuthenticationAPITests(APITestCase):
    def setUp(self):
        self.role = Role.objects.create(
            name="Administrador",
            code="ADMIN",
        )
        self.user = User.objects.create_user(
            username="administrador",
            email="admin@idesem.com",
            password="Password123!",
            role=self.role,
        )

    def login(self):
        return self.client.post(
            "/api/v1/auth/login/",
            {
                "username": "administrador",
                "password": "Password123!",
            },
            format="json",
        )

    def test_login_returns_tokens_and_effective_admin_flag(self):
        response = self.login()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertTrue(response.data["user"]["is_admin"])

    def test_login_rejects_invalid_credentials(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {
                "username": "administrador",
                "password": "incorrecta",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_rotates_tokens(self):
        login_response = self.login()
        old_refresh = login_response.data["refresh"]

        response = self.client.post(
            "/api/v1/auth/refresh/",
            {"refresh": old_refresh},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertNotEqual(response.data["refresh"], old_refresh)

    def test_me_returns_superuser_as_admin(self):
        superuser = User.objects.create_superuser(
            username="root",
            email="root@idesem.com",
            password="Password123!",
        )
        self.client.force_authenticate(superuser)

        response = self.client.get("/api/v1/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_admin"])

    def test_user_cannot_deactivate_itself(self):
        self.client.force_authenticate(self.user)

        response = self.client.patch(
            f"/api/v1/users/{self.user.pk}/",
            {"is_active": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("is_active", response.data)


class CorsConfigurationTests(APITestCase):
    @override_settings(CORS_ALLOWED_ORIGINS=["http://localhost:5173"])
    def test_frontend_origin_is_allowed(self):
        response = self.client.options(
            "/api/v1/auth/login/",
            HTTP_ORIGIN="http://localhost:5173",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        )

        self.assertEqual(
            response.headers.get("access-control-allow-origin"),
            "http://localhost:5173",
        )
