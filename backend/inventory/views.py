from drf_spectacular.utils import (
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import (
    status,
    viewsets,
)
from rest_framework.response import Response

from users.permissions import HasRoleModelPermission

from .filters import (
    StockFilter,
    StockMovementFilter,
)
from .models import (
    Stock,
    StockMovement,
    Warehouse,
)
from .serializers import (
    StockCreateSerializer,
    StockMovementCreateSerializer,
    StockMovementReadSerializer,
    StockReadSerializer,
    StockUpdateSerializer,
    WarehouseSerializer,
)


class InventoryPermissionMixin:
    def get_permissions(self):
        return [HasRoleModelPermission()]


@extend_schema_view(
    list=extend_schema(
        tags=["Inventario - Almacenes"],
        summary="Listar almacenes",
    ),
    retrieve=extend_schema(
        tags=["Inventario - Almacenes"],
        summary="Consultar almacén",
    ),
    create=extend_schema(
        tags=["Inventario - Almacenes"],
        summary="Registrar almacén",
    ),
    update=extend_schema(
        tags=["Inventario - Almacenes"],
        summary="Actualizar almacén",
    ),
    partial_update=extend_schema(
        tags=["Inventario - Almacenes"],
        summary="Actualizar parcialmente un almacén",
    ),
)
class WarehouseViewSet(
    InventoryPermissionMixin,
    viewsets.ModelViewSet,
):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer

    filterset_fields = [
        "is_active",
    ]

    search_fields = [
        "name",
        "code",
        "address",
        "description",
    ]

    ordering_fields = [
        "name",
        "code",
        "created_at",
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
        tags=["Inventario - Existencias"],
        summary="Listar existencias",
        description=(
            "Permite consultar el stock físico, reservado "
            "y disponible por producto y almacén."
        ),
    ),
    retrieve=extend_schema(
        tags=["Inventario - Existencias"],
        summary="Consultar existencia",
    ),
    create=extend_schema(
        tags=["Inventario - Existencias"],
        summary="Crear registro inicial de stock",
        request=StockCreateSerializer,
        responses={
            201: StockReadSerializer,
        },
    ),
    update=extend_schema(
        tags=["Inventario - Existencias"],
        summary="Actualizar stock mínimo",
        request=StockUpdateSerializer,
        responses={
            200: StockReadSerializer,
        },
    ),
    partial_update=extend_schema(
        tags=["Inventario - Existencias"],
        summary="Actualizar parcialmente el stock mínimo",
        request=StockUpdateSerializer,
        responses={
            200: StockReadSerializer,
        },
    ),
)
class StockViewSet(
    InventoryPermissionMixin,
    viewsets.ModelViewSet,
):
    queryset = (
        Stock.objects
        .select_related(
            "product",
            "product__category",
            "warehouse",
        )
        .prefetch_related(
            "product__images",
            "product__stocks",
        )
        .all()
    )

    filterset_class = StockFilter

    search_fields = [
        "product__name",
        "product__sku",
        "product__barcode",
        "warehouse__name",
        "warehouse__code",
    ]

    ordering_fields = [
        "quantity",
        "reserved_quantity",
        "minimum_stock",
        "updated_at",
    ]

    ordering = [
        "warehouse",
        "product",
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
        if self.action == "create":
            return StockCreateSerializer

        if self.action in {
            "update",
            "partial_update",
        }:
            return StockUpdateSerializer

        return StockReadSerializer

    def create(self, request, *args, **kwargs):
        serializer = StockCreateSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )

        serializer.is_valid(raise_exception=True)
        stock = serializer.save()

        return Response(
            StockReadSerializer(
                stock,
                context=self.get_serializer_context(),
            ).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop(
            "partial",
            False,
        )

        stock = self.get_object()

        serializer = StockUpdateSerializer(
            stock,
            data=request.data,
            partial=partial,
            context=self.get_serializer_context(),
        )

        serializer.is_valid(raise_exception=True)
        stock = serializer.save()

        return Response(
            StockReadSerializer(
                stock,
                context=self.get_serializer_context(),
            ).data
        )


@extend_schema_view(
    list=extend_schema(
        tags=["Inventario - Movimientos"],
        summary="Listar movimientos de inventario",
    ),
    retrieve=extend_schema(
        tags=["Inventario - Movimientos"],
        summary="Consultar movimiento de inventario",
    ),
    create=extend_schema(
        tags=["Inventario - Movimientos"],
        summary="Registrar entrada, salida o ajuste",
        description=(
            "Actualiza el stock y registra el movimiento "
            "dentro de una única transacción."
        ),
        request=StockMovementCreateSerializer,
        responses={
            201: StockMovementReadSerializer,
            400: OpenApiResponse(
                description="Movimiento inválido.",
            ),
        },
    ),
)
class StockMovementViewSet(
    InventoryPermissionMixin,
    viewsets.ModelViewSet,
):
    queryset = (
        StockMovement.objects
        .select_related(
            "stock",
            "stock__product",
            "stock__warehouse",
            "created_by",
        )
        .all()
    )

    filterset_class = StockMovementFilter

    search_fields = [
        "stock__product__name",
        "stock__product__sku",
        "stock__warehouse__name",
        "reference",
        "notes",
        "created_by__username",
    ]

    ordering_fields = [
        "created_at",
        "quantity_delta",
        "resulting_quantity",
    ]

    ordering = [
        "-created_at",
    ]

    http_method_names = [
        "get",
        "post",
        "head",
        "options",
    ]

    def get_serializer_class(self):
        if self.action == "create":
            return StockMovementCreateSerializer

        return StockMovementReadSerializer
