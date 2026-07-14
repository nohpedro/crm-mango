from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Role, User


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "is_active",
        "created_at",
        "updated_at",
    )

    list_filter = (
        "is_active",
    )

    search_fields = (
        "name",
        "code",
        "description",
    )

    filter_horizontal = (
        "permissions",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    ordering = (
        "name",
    )


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    model = User

    list_display = (
        "email",
        "username",
        "first_name",
        "last_name",
        "role",
        "is_active",
        "is_staff",
        "last_login",
    )

    list_filter = (
        "is_active",
        "is_staff",
        "is_superuser",
        "role",
    )

    search_fields = (
        "email",
        "username",
        "first_name",
        "last_name",
    )

    ordering = (
        "email",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
        "last_login",
        "date_joined",
    )

    fieldsets = UserAdmin.fieldsets + (
        (
            "CRM IDESEM",
            {
                "fields": (
                    "role",
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        (
            "Datos personales",
            {
                "fields": (
                    "email",
                    "first_name",
                    "last_name",
                    "role",
                    "is_active",
                ),
            },
        ),
    )