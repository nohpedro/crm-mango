from django.contrib.auth.base_user import BaseUserManager


class UserManager(BaseUserManager):
    """
    Administrador de usuarios autenticados mediante nombre de usuario.
    """

    use_in_migrations = True

    def create_user(
        self,
        username: str,
        email: str,
        password: str | None = None,
        **extra_fields,
    ):
        if not username:
            raise ValueError(
                "El nombre de usuario es obligatorio."
            )

        if not email:
            raise ValueError(
                "El correo electrónico es obligatorio."
            )

        username = username.strip()
        email = self.normalize_email(email).strip().lower()

        user = self.model(
            username=username,
            email=email,
            **extra_fields,
        )

        user.set_password(password)
        user.save(using=self._db)

        return user

    def create_superuser(
        self,
        username: str,
        email: str,
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
            username=username,
            email=email,
            password=password,
            **extra_fields,
        )