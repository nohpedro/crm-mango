from rest_framework.permissions import BasePermission


class IsAdministrator(BasePermission):
    """
    Permite el acceso a superusuarios y usuarios con rol ADMIN.
    """

    message = (
        "Se requiere un usuario administrador "
        "para realizar esta operación."
    )

    def has_permission(self, request, view) -> bool:
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        return bool(
            user.role
            and user.role.is_active
            and user.role.code == "ADMIN"
        )