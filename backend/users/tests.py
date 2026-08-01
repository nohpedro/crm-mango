from django.test import override_settings
from django.contrib.auth.models import Permission
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APITestCase

from inventory.models import Warehouse
from products.models import PriceLevel
from quotations.models import QuotationTemplate

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

    def test_login_returns_role_permissions_for_the_frontend(self):
        permission = Permission.objects.get(
            content_type__app_label="clients",
            codename="view_client",
        )
        self.role.permissions.add(permission)

        response = self.login()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("clients.view_client", response.data["user"]["permissions"])

    def test_permission_catalog_hides_internal_django_permissions(self):
        self.client.force_authenticate(self.user)

        response = self.client.get("/api/v1/permissions/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data)
        self.assertNotIn("admin", {item["app_label"] for item in response.data})
        self.assertNotIn("auth", {item["app_label"] for item in response.data})
        quotation_permissions = {
            item["codename"]
            for item in response.data
            if item["app_label"] == "quotations" and item["model"] == "quotation"
        }
        self.assertIn("configure_quotation_document", quotation_permissions)
        self.assertIn("manage_quotation_templates", quotation_permissions)

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


class RolePermissionAPITests(APITestCase):
    def setUp(self):
        role = Role.objects.create(name="Solo clientes", code="CLIENTS")
        role.permissions.add(
            Permission.objects.get(
                content_type__app_label="clients",
                codename="view_client",
            )
        )
        self.user = User.objects.create_user(
            username="cliente-view",
            email="cliente-view@example.com",
            password="Password123!",
            role=role,
        )
        self.client.force_authenticate(self.user)

    def test_role_permission_allows_only_its_assigned_module(self):
        allowed = self.client.get("/api/v1/clients/")
        rejected = self.client.get("/api/v1/catalog/products/")

        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        self.assertEqual(rejected.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_and_role_screens_use_assigned_permissions(self):
        users_denied = self.client.get("/api/v1/users/")
        roles_denied = self.client.get("/api/v1/roles/")
        self.assertEqual(users_denied.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(roles_denied.status_code, status.HTTP_403_FORBIDDEN)

        self.user.role.permissions.add(
            Permission.objects.get(
                content_type__app_label="users",
                codename="view_user",
            ),
            Permission.objects.get(
                content_type__app_label="users",
                codename="view_role",
            ),
        )

        self.assertEqual(self.client.get("/api/v1/users/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get("/api/v1/roles/").status_code, status.HTTP_200_OK)

    def test_permission_catalog_requires_role_management_permission(self):
        denied = self.client.get("/api/v1/permissions/")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.user.role.permissions.add(
            Permission.objects.get(
                content_type__app_label="users",
                codename="change_role",
            )
        )
        allowed = self.client.get("/api/v1/permissions/")
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)


class DemoUserSeedCommandTests(APITestCase):
    def test_command_creates_demo_roles_and_users_without_duplicates(self):
        call_command("seed_demo_users")

        self.assertEqual(Role.objects.filter(code__in=["ADMIN", "SALES", "CATALOG", "INVENTORY", "VIEWER"]).count(), 5)
        commercial = User.objects.get(username="demo_comercial")
        self.assertEqual(commercial.role.code, "SALES")
        self.assertTrue(commercial.check_password("Demo12345!"))
        self.assertTrue(
            commercial.role.permissions.filter(
                content_type__app_label="quotations",
                codename="add_quotation",
            ).exists()
        )
        self.assertTrue(
            QuotationTemplate.objects.filter(name="Cotización profesional IDESEM").exists()
        )
        expected_system_roles = {
            "admin": "ADMIN",
            "cajero": "SALES",
            "inventarios": "INVENTORY",
            "configuraciones": "CATALOG",
        }
        for username, role_code in expected_system_roles.items():
            seeded = User.objects.get(username=username)
            self.assertEqual(seeded.role.code, role_code)
            self.assertTrue(seeded.check_password("Demo12345!"))
        self.assertEqual(
            PriceLevel.objects.filter(
                name__in=["Mayorista", "Minorista", "Preferencial"]
            ).count(),
            3,
        )
        self.assertEqual(
            Warehouse.objects.filter(name__iexact="Principal").count(),
            1,
        )

        commercial.set_password("AnotherPassword123!")
        commercial.save()
        call_command("seed_system_data")

        commercial.refresh_from_db()
        self.assertTrue(commercial.check_password("AnotherPassword123!"))
        self.assertEqual(User.objects.filter(username__startswith="demo_").count(), 5)
        self.assertEqual(
            User.objects.filter(username__in=expected_system_roles).count(),
            4,
        )
        self.assertEqual(
            PriceLevel.objects.filter(
                name__in=["Mayorista", "Minorista", "Preferencial"]
            ).count(),
            3,
        )
        self.assertEqual(
            Warehouse.objects.filter(name__iexact="Principal").count(),
            1,
        )
