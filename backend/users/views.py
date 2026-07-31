from django.contrib.auth.models import Permission
from django.db.models import F, Q
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import filters, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from inventory.models import Stock
from quotations.models import Quotation
from .models import Role, User
from .permissions import HasRoleModelPermission, IsAdministrator
from .serializers import (
    ErrorSerializer,
    LoginRequestSerializer,
    LoginResponseSerializer,
    LogoutSerializer,
    PermissionSerializer,
    RefreshRequestSerializer,
    RefreshResponseSerializer,
    RoleSerializer,
    UserReadSerializer,
    UserWriteSerializer,
)


@extend_schema_view(
    list=extend_schema(
        tags=["Roles"],
        summary="Listar roles",
        description=(
            "Devuelve los roles registrados en el sistema."
        ),
    ),
    retrieve=extend_schema(
        tags=["Roles"],
        summary="Consultar rol",
        description=(
            "Devuelve la información de un rol específico."
        ),
    ),
    create=extend_schema(
        tags=["Roles"],
        summary="Crear rol",
        description=(
            "Registra un nuevo rol y permite asignarle "
            "permisos de Django."
        ),
    ),
    update=extend_schema(
        tags=["Roles"],
        summary="Actualizar rol",
    ),
    partial_update=extend_schema(
        tags=["Roles"],
        summary="Actualizar parcialmente un rol",
    ),
)
class RoleViewSet(viewsets.ModelViewSet):
    serializer_class = RoleSerializer
    permission_classes = [IsAdministrator]

    queryset = (
        Role.objects
        .prefetch_related(
            "permissions",
            "permissions__content_type",
        )
        .all()
    )

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "name",
        "code",
        "description",
    ]

    ordering_fields = [
        "name",
        "code",
        "created_at",
        "updated_at",
    ]

    ordering = [
        "name",
    ]

    http_method_names = [
        "get",
        "post",
        "put",
        "patch",
        "head",
        "options",
    ]


@extend_schema_view(
    list=extend_schema(
        tags=["Usuarios"],
        summary="Listar usuarios",
        description=(
            "Devuelve los usuarios registrados. "
            "Requiere permisos administrativos."
        ),
        responses={
            200: UserReadSerializer(many=True),
            401: ErrorSerializer,
            403: ErrorSerializer,
        },
    ),
    retrieve=extend_schema(
        tags=["Usuarios"],
        summary="Consultar usuario",
        responses={
            200: UserReadSerializer,
            404: ErrorSerializer,
        },
    ),
    create=extend_schema(
        tags=["Usuarios"],
        summary="Crear usuario",
        description=(
            "Registra un usuario y cifra su contraseña."
        ),
        request=UserWriteSerializer,
        responses={
            201: UserReadSerializer,
            400: ErrorSerializer,
            401: ErrorSerializer,
            403: ErrorSerializer,
        },
    ),
    update=extend_schema(
        tags=["Usuarios"],
        summary="Actualizar usuario",
        request=UserWriteSerializer,
        responses={
            200: UserReadSerializer,
        },
    ),
    partial_update=extend_schema(
        tags=["Usuarios"],
        summary="Actualizar parcialmente un usuario",
        request=UserWriteSerializer,
        responses={
            200: UserReadSerializer,
        },
    ),
)
class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdministrator]

    queryset = (
        User.objects
        .select_related("role")
        .all()
    )

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "email",
        "username",
        "first_name",
        "last_name",
        "role__name",
        "role__code",
    ]

    ordering_fields = [
        "email",
        "username",
        "first_name",
        "last_name",
        "created_at",
        "last_login",
    ]

    ordering = [
        "first_name",
        "last_name",
        "email",
    ]

    http_method_names = [
        "get",
        "post",
        "put",
        "patch",
        "head",
        "options",
    ]

    def get_serializer_class(self):
        if self.action in {
            "create",
            "update",
            "partial_update",
        }:
            return UserWriteSerializer

        return UserReadSerializer


class SystemNotificationsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        is_admin = user.is_superuser or bool(
            user.role and user.role.is_active and user.role.code == "ADMIN"
        )

        def can(permission):
            return is_admin or HasRoleModelPermission._has_permission(
                user,
                permission,
            )

        items = []
        if can("quotations.view_quotation"):
            draft_count = Quotation.objects.filter(
                status=Quotation.Status.DRAFT
            ).count()
            if draft_count:
                items.append(
                    {
                        "id": "draft-quotations",
                        "title": "Cotizaciones pendientes",
                        "message": (
                            f"{draft_count} "
                            f"{'cotización' if draft_count == 1 else 'cotizaciones'} "
                            "en borrador."
                        ),
                        "path": "/quotations/history?status=draft",
                        "tone": "warning",
                    }
                )

        if can("inventory.view_stock"):
            low_stock_count = (
                Stock.objects.annotate(
                    available=F("quantity") - F("reserved_quantity")
                )
                .filter(available__lte=F("minimum_stock"))
                .count()
            )
            if low_stock_count:
                items.append(
                    {
                        "id": "low-stock",
                        "title": "Productos con stock bajo",
                        "message": (
                            f"{low_stock_count} existencia"
                            f"{'s' if low_stock_count != 1 else ''} requieren revisión."
                        ),
                        "path": "/inventory",
                        "tone": "danger",
                    }
                )

        return Response({"count": len(items), "items": items})


class LoginAPIView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Autenticación"],
        summary="Iniciar sesión",
        description=(
                "Autentica mediante el nombre de usuario y la contraseña. "
                "Devuelve access token, refresh token y los datos básicos "
                "del usuario."
        ),
        request=LoginRequestSerializer,
        responses={
            200: LoginResponseSerializer,
            400: ErrorSerializer,
            401: ErrorSerializer,
        },
        examples=[
            OpenApiExample(
                "Inicio de sesión con correo",
                value={
                    "username": "admin@idesem.com",
                    "password": "Password123!",
                },
                request_only=True,
            ),
            OpenApiExample(
                "Inicio con nombre de usuario",
                value={
                    "username": "administrador",
                    "password": "Password123!",
                },
                request_only=True,
            ),
        ],
        auth=[],
    )
    def post(self, request):
        serializer = LoginRequestSerializer(
            data=request.data,
            context={
                "request": request,
            },
        )

        serializer.is_valid(raise_exception=True)

        return Response(
            serializer.validated_data,
            status=status.HTTP_200_OK,
        )


class RefreshAPIView(TokenRefreshView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        tags=["Autenticación"],
        summary="Renovar tokens",
        description=(
            "Recibe un refresh token válido y devuelve un nuevo "
            "access token. Como la rotación está habilitada, "
            "también devuelve un nuevo refresh token."
        ),
        request=RefreshRequestSerializer,
        responses={
            200: RefreshResponseSerializer,
            401: ErrorSerializer,
        },
        examples=[
            OpenApiExample(
                "Renovación de sesión",
                value={
                    "refresh": (
                        "eyJhbGciOiJIUzI1NiIs"
                        "InR5cCI6IkpXVCJ9..."
                    ),
                },
                request_only=True,
            ),
        ],
        auth=[],
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Autenticación"],
        summary="Cerrar sesión",
        description=(
            "Bloquea el refresh token enviado. "
            "El access token seguirá siendo válido "
            "hasta que alcance su fecha de expiración."
        ),
        request=LogoutSerializer,
        responses={
            204: OpenApiResponse(
                description=(
                    "Sesión cerrada correctamente."
                ),
            ),
            400: ErrorSerializer,
            401: ErrorSerializer,
        },
        examples=[
            OpenApiExample(
                "Cerrar sesión",
                value={
                    "refresh": (
                        "eyJhbGciOiJIUzI1NiIs"
                        "InR5cCI6IkpXVCJ9..."
                    ),
                },
                request_only=True,
            ),
        ],
    )
    def post(self, request):
        serializer = LogoutSerializer(
            data=request.data,
            context={
                "request": request,
            },
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )


class CurrentUserAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Autenticación"],
        summary="Consultar usuario autenticado",
        description=(
            "Devuelve los datos correspondientes "
            "al access token enviado."
        ),
        responses={
            200: UserReadSerializer,
            401: ErrorSerializer,
        },
    )
    def get(self, request):
        serializer = UserReadSerializer(
            request.user,
            context={
                "request": request,
            },
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


class PermissionListAPIView(APIView):
    permission_classes = [IsAdministrator]

    @extend_schema(
        tags=["Roles"],
        summary="Listar permisos disponibles",
        description=(
            "Devuelve los permisos nativos de Django "
            "que pueden asignarse a un rol."
        ),
        responses={
            200: PermissionSerializer(many=True),
            401: ErrorSerializer,
            403: ErrorSerializer,
        },
    )
    def get(self, request):
        # Solo se exponen permisos que representan funciones visibles del CRM.
        # Los permisos internos de Django (sesiones, grupos, log, tokens, etc.)
        # no son útiles para configurar un rol operativo.
        user_facing_models = {
            "clients": ("client", "clienttype"),
            "inventory": ("stock", "stockmovement", "warehouse"),
            "products": (
                "category",
                "pricelevel",
                "pricetier",
                "product",
                "productimage",
                "productprice",
            ),
            "quotations": ("quotation", "quotationitem"),
            "users": ("role", "user"),
        }
        filters = Q()
        for app_label, models in user_facing_models.items():
            filters |= Q(content_type__app_label=app_label, content_type__model__in=models)
        permissions = (
            Permission.objects
            .select_related("content_type")
            .filter(filters)
            .order_by(
                "content_type__app_label",
                "content_type__model",
                "codename",
            )
        )

        serializer = PermissionSerializer(
            permissions,
            many=True,
        )

        return Response(serializer.data)
