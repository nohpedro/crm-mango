from rest_framework.permissions import BasePermission

from .permission_dependencies import dependencies_for_code


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


class HasRoleModelPermission(BasePermission):
    """Autoriza una operación usando los permisos funcionales del rol del usuario."""

    message = "No tienes permiso para realizar esta acción."

    action_prefixes = {
        "list": "view",
        "retrieve": "view",
        "applicable_price": "view",
        "quotation_price": "view",
        "pdf": "view",
        "create": "add",
        "update": "change",
        "partial_update": "change",
        "activate": "change",
        "deactivate": "change",
        "restore": "change",
        "destroy": "delete",
    }

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or (
            user.role and user.role.is_active and user.role.code == "ADMIN"
        ):
            return True

        required_permission = getattr(view, "required_permission", None)
        if required_permission:
            return self._has_permission(user, required_permission)

        required_any_permissions = getattr(view, "required_any_permissions", None)
        if required_any_permissions:
            return any(
                self._has_permission(user, permission)
                for permission in required_any_permissions
            )

        required_all_permissions = getattr(view, "required_all_permissions", None)
        if required_all_permissions:
            return all(
                self._has_permission(user, permission)
                for permission in required_all_permissions
            )

        queryset = getattr(view, "queryset", None)
        model = getattr(queryset, "model", None)
        if not model:
            try:
                model = view.get_queryset().model
            except (AttributeError, TypeError):
                model = None
        action = getattr(view, "action", None)
        prefix = self.action_prefixes.get(action)
        if not model or not prefix:
            return False

        required_permission = f"{model._meta.app_label}.{prefix}_{model._meta.model_name}"
        return self._has_permission(user, required_permission)

    @staticmethod
    def _has_permission(user, permission_code: str, checked=None) -> bool:
        if user.is_superuser or (
            user.role and user.role.is_active and user.role.code == "ADMIN"
        ):
            return True
        checked = set(checked or ())
        if permission_code in checked:
            return True
        checked.add(permission_code)

        assigned = user.has_perm(permission_code)
        if user.role and user.role.is_active and not assigned:
            app_label, codename = permission_code.split(".", maxsplit=1)
            assigned = user.role.permissions.filter(
                content_type__app_label=app_label,
                codename=codename,
            ).exists()
        return assigned and all(
            HasRoleModelPermission._has_permission(user, dependency, checked)
            for dependency in dependencies_for_code(permission_code)
        )
