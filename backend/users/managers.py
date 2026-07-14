from django.contrib.auth.base_user import BaseUserManager


class UserManager(BaseUserManager):
    """
    Administrador personalizado para usuarios autenticados mediante correo.
    """

    use_in_migrations = True

    def create_user(
        self,
        email: str,
        username: str,
        password: str | None = None,
        **extra_fields,
    ):
        if not email:
            raise ValueError(
                "El correo electrónico es obligatorio."
            )

        if not username:
            raise ValueError(
                "El nombre de usuario es obligatorio."
            )

        email = self.normalize_email(email).strip().lower()
        username = username.strip()

        user = self.model(
            email=email,
            username=username,
            **extra_fields,
        )

        user.set_password(password)
        user.save(using=self._db)

        return user

    def create_superuser(
        self,
        email: str,
        username: str,
        password: str | None = None,
        **extra_fields,
    ):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError(
                "El superusuario debe tener is_staff=True."
            )

        if extra_fields.get("is_superuser") is not True:
            raise ValueError(
                "El superusuario debe tener is_superuser=True."
            )

        return self.create_user(
            email=email,
            username=username,
            password=password,
            **extra_fields,
        )