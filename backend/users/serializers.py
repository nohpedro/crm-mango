from django.contrib.auth import authenticate
from django.contrib.auth.models import Permission
from django.contrib.auth.models import update_last_login
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Role, User


class PermissionSerializer(serializers.ModelSerializer):
    """
    Representación resumida de un permiso nativo de Django.
    """

    app_label = serializers.CharField(
        source="content_type.app_label",
        read_only=True,
    )

    model = serializers.CharField(
        source="content_type.model",
        read_only=True,
    )

    class Meta:
        model = Permission
        fields = (
            "id",
            "name",
            "codename",
            "app_label",
            "model",
        )


class RoleSummarySerializer(serializers.ModelSerializer):
    """
    Representación resumida del rol asignado a un usuario.
    """

    class Meta:
        model = Role
        fields = (
            "id",
            "name",
            "code",
        )


class RoleSerializer(serializers.ModelSerializer):
    """
    Serializer para crear, consultar y actualizar roles.
    """

    permissions = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(),
        many=True,
        required=False,
    )

    permission_details = PermissionSerializer(
        source="permissions",
        many=True,
        read_only=True,
    )

    class Meta:
        model = Role
        fields = (
            "id",
            "name",
            "code",
            "description",
            "permissions",
            "permission_details",
            "is_active",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "permission_details",
            "created_at",
            "updated_at",
        )

        extra_kwargs = {
            "name": {
                "validators": [],
            },
            "code": {
                "validators": [],
            },
        }

    def validate_name(self, value: str) -> str:
        value = value.strip()

        queryset = Role.objects.filter(name__iexact=value)

        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError(
                "Ya existe un rol con este nombre."
            )

        return value

    def validate_code(self, value: str) -> str:
        value = value.strip().upper()

        queryset = Role.objects.filter(code__iexact=value)

        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError(
                "Ya existe un rol con este código."
            )

        return value


class UserReadSerializer(serializers.ModelSerializer):
    """
    Representación pública de un usuario.
    """

    role = RoleSummarySerializer(read_only=True)

    full_name = serializers.SerializerMethodField()

    is_admin = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "is_active",
            "is_staff",
            "is_admin",
            "role",
            "last_login",
            "created_at",
            "updated_at",
        )

    def get_full_name(self, obj: User) -> str:
        return obj.get_full_name().strip()

    def get_is_admin(self, obj: User) -> bool:
        if obj.is_superuser:
            return True

        return bool(
            obj.role
            and obj.role.is_active
            and obj.role.code == "ADMIN"
        )


class UserWriteSerializer(serializers.ModelSerializer):
    """
    Serializer utilizado para crear y modificar usuarios.
    """

    password = serializers.CharField(
        write_only=True,
        required=False,
        min_length=8,
        trim_whitespace=False,
        style={
            "input_type": "password",
        },
    )

    role = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "role",
            "is_active",
        )

        read_only_fields = (
            "id",
        )

        extra_kwargs = {
            "email": {
                "validators": [],
            },
            "username": {
                "validators": [],
            },
        }

    def validate_email(self, value: str) -> str:
        value = value.strip().lower()

        queryset = User.objects.filter(email__iexact=value)

        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError(
                "Ya existe un usuario con este correo."
            )

        return value

    def validate_username(self, value: str) -> str:
        value = value.strip()

        queryset = User.objects.filter(username__iexact=value)

        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError(
                "Ya existe un usuario con este nombre de usuario."
            )

        return value

    def validate_password(self, value: str) -> str:
        validate_password(
            password=value,
            user=self.instance,
        )

        return value

    def validate(self, attrs):
        request = self.context.get("request")

        if (
            self.instance
            and request
            and request.user.is_authenticated
            and request.user.pk == self.instance.pk
            and attrs.get("is_active") is False
        ):
            raise serializers.ValidationError(
                {
                    "is_active": (
                        "No puedes desactivar tu propio usuario."
                    )
                }
            )

        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError(
                {
                    "password": (
                        "La contraseña es obligatoria "
                        "para crear un usuario."
                    )
                }
            )

        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")

        return User.objects.create_user(
            password=password,
            **validated_data,
        )

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if password:
            instance.set_password(password)

        instance.save()

        return instance

    def to_representation(self, instance):
        return UserReadSerializer(
            instance,
            context=self.context,
        ).data


class LoginRequestSerializer(serializers.Serializer):
    """
    Credenciales para iniciar sesión mediante nombre de usuario.
    """

    username = serializers.CharField(
        max_length=150,
        help_text="Nombre de usuario registrado.",
    )

    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        style={
            "input_type": "password",
        },
    )

    def validate_username(self, value: str) -> str:
        return value.strip()

    def validate(self, attrs):
        username = attrs["username"]
        password = attrs["password"]

        user = authenticate(
            request=self.context.get("request"),
            username=username,
            password=password,
        )

        if user is None:
            raise AuthenticationFailed(
                "El nombre de usuario o la contraseña no son válidos."
            )

        if not user.is_active:
            raise AuthenticationFailed(
                "El usuario se encuentra inactivo."
            )

        user = (
            User.objects
            .select_related("role")
            .get(pk=user.pk)
        )

        refresh = RefreshToken.for_user(user)

        role_code = user.role.code if user.role else None

        refresh["email"] = user.email
        refresh["username"] = user.username
        refresh["role"] = role_code

        update_last_login(None, user)

        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "token_type": "Bearer",
            "user": UserReadSerializer(user).data,
        }


class LoginResponseSerializer(serializers.Serializer):
    """
    Respuesta del inicio de sesión.
    """

    access = serializers.CharField()

    refresh = serializers.CharField()

    token_type = serializers.CharField()

    user = UserReadSerializer()


class RefreshRequestSerializer(serializers.Serializer):
    """
    Refresh token utilizado para renovar la sesión.
    """

    refresh = serializers.CharField()


class RefreshResponseSerializer(serializers.Serializer):
    """
    Tokens obtenidos después de renovar la sesión.
    """

    access = serializers.CharField()

    refresh = serializers.CharField()


class LogoutSerializer(serializers.Serializer):
    """
    Bloquea el refresh token del usuario autenticado.
    """

    refresh = serializers.CharField(
        help_text=(
            "Refresh token que se desea invalidar."
        ),
    )

    def validate_refresh(self, value: str) -> str:
        try:
            token = RefreshToken(value)
        except TokenError as error:
            raise serializers.ValidationError(
                "El refresh token no es válido o ha expirado."
            ) from error

        request = self.context.get("request")

        token_user_id = str(token.get("user_id"))
        request_user_id = str(request.user.pk)

        if token_user_id != request_user_id:
            raise serializers.ValidationError(
                "El refresh token no pertenece al usuario autenticado."
            )

        self.token = token

        return value

    def save(self, **kwargs):
        try:
            self.token.blacklist()
        except TokenError as error:
            raise serializers.ValidationError(
                {
                    "refresh": (
                        "El refresh token ya fue invalidado."
                    )
                }
            ) from error


class ErrorSerializer(serializers.Serializer):
    """
    Esquema general de error.
    """

    detail = serializers.CharField()
