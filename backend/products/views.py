from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import (
    filters,
    status,
    viewsets,
)
from rest_framework.decorators import action
from rest_framework.parsers import (
    FormParser,
    MultiPartParser,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsAdministrator

from .filters import (
    ProductFilter,
    ProductPriceFilter,
)
from .models import (
    Category,
    PriceLevel,
    Product,
    ProductImage,
    ProductPrice,
)
from .serializers import (
    CategorySerializer,
    PriceLevelSerializer,
    ProductDetailSerializer,
    ProductImageSerializer,
    ProductListSerializer,
    ProductPriceSerializer,
    ProductWriteSerializer,
)


class CatalogPermissionMixin:
    """
    Los usuarios autenticados pueden consultar.
    Solo administradores pueden modificar.
    """

    def get_permissions(self):
        safe_actions = {
            "list",
            "retrieve",
            "applicable_price",
        }

        if self.action in safe_actions:
            return [IsAuthenticated()]

        return [IsAdministrator()]


@extend_schema_view(
    list=extend_schema(
        tags=["Catálogo - Categorías"],
        summary="Listar categorías",
    ),
    retrieve=extend_schema(
        tags=["Catálogo - Categorías"],
        summary="Consultar categoría",
    ),
    create=extend_schema(
        tags=["Catálogo - Categorías"],
        summary="Registrar categoría",
    ),
    update=extend_schema(
        tags=["Catálogo - Categorías"],
        summary="Actualizar categoría",
    ),
    partial_update=extend_schema(
        tags=["Catálogo - Categorías"],
        summary="Actualizar parcialmente una categoría",
    ),
)
class CategoryViewSet(
    CatalogPermissionMixin,
    viewsets.ModelViewSet,
):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    filterset_fields = [
        "is_active",
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
        tags=["Catálogo - Niveles de precio"],
        summary="Listar niveles de precio",
    ),
    retrieve=extend_schema(
        tags=["Catálogo - Niveles de precio"],
        summary="Consultar nivel de precio",
    ),
    create=extend_schema(
        tags=["Catálogo - Niveles de precio"],
        summary="Registrar nivel de precio",
    ),
    update=extend_schema(
        tags=["Catálogo - Niveles de precio"],
        summary="Actualizar nivel de precio",
    ),
    partial_update=extend_schema(
        tags=["Catálogo - Niveles de precio"],
        summary="Actualizar parcialmente un nivel",
    ),
)
class PriceLevelViewSet(
    CatalogPermissionMixin,
    viewsets.ModelViewSet,
):
    queryset = PriceLevel.objects.all()
    serializer_class = PriceLevelSerializer
    filterset_fields = [
        "is_active",
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
        tags=["Catálogo - Productos"],
        summary="Listar y buscar productos",
        description=(
            "Permite buscar productos por nombre, SKU, código "
            "de barras, categoría y estado."
        ),
    ),
    retrieve=extend_schema(
        tags=["Catálogo - Productos"],
        summary="Consultar producto",
    ),
    create=extend_schema(
        tags=["Catálogo - Productos"],
        summary="Registrar producto",
        request=ProductWriteSerializer,
        responses={
            201: ProductDetailSerializer,
        },
    ),
    update=extend_schema(
        tags=["Catálogo - Productos"],
        summary="Actualizar producto",
        request=ProductWriteSerializer,
        responses={
            200: ProductDetailSerializer,
        },
    ),
    partial_update=extend_schema(
        tags=["Catálogo - Productos"],
        summary="Actualizar parcialmente un producto",
        request=ProductWriteSerializer,
        responses={
            200: ProductDetailSerializer,
        },
    ),
    destroy=extend_schema(
        tags=["Catálogo - Productos"],
        summary="Archivar producto",
        responses={
            204: OpenApiResponse(
                description="Producto archivado.",
            ),
        },
    ),
)
class ProductViewSet(
    CatalogPermissionMixin,
    viewsets.ModelViewSet,
):
    filterset_class = ProductFilter

    search_fields = [
        "name",
        "sku",
        "barcode",
        "description",
        "category__name",
        "category__code",
    ]

    ordering_fields = [
        "name",
        "sku",
        "created_at",
        "updated_at",
    ]

    ordering = [
        "name",
        "sku",
    ]

    def get_queryset(self):
        queryset = (
            Product.objects
            .select_related(
                "category",
                "created_by",
                "updated_by",
            )
            .prefetch_related(
                "images",
                "prices",
                "prices__price_level",
                "stocks",
            )
        )

        include_deleted = (
            self.request.query_params.get(
                "include_deleted",
                "false",
            ).lower()
            == "true"
        )

        # La acción de reactivación debe poder localizar productos archivados;
        # el resto de operaciones mantiene ocultos los registros archivados.
        if not include_deleted and self.action != "restore":
            queryset = queryset.filter(
                deleted_at__isnull=True,
            )

        return queryset

    def get_serializer_class(self):
        if self.action in {
            "create",
            "update",
            "partial_update",
        }:
            return ProductWriteSerializer

        if self.action == "list":
            return ProductListSerializer

        return ProductDetailSerializer

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(
            updated_by=self.request.user,
        )

    def create(self, request, *args, **kwargs):
        serializer = ProductWriteSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )

        serializer.is_valid(raise_exception=True)

        product = serializer.save(
            created_by=request.user,
            updated_by=request.user,
        )

        output = ProductDetailSerializer(
            product,
            context=self.get_serializer_context(),
        )

        return Response(
            output.data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop(
            "partial",
            False,
        )

        instance = self.get_object()

        serializer = ProductWriteSerializer(
            instance,
            data=request.data,
            partial=partial,
            context=self.get_serializer_context(),
        )

        serializer.is_valid(raise_exception=True)

        product = serializer.save(
            updated_by=request.user,
        )

        output = ProductDetailSerializer(
            product,
            context=self.get_serializer_context(),
        )

        return Response(output.data)

    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        product.updated_by = request.user
        product.soft_delete()

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )

    @extend_schema(
        tags=["Catálogo - Productos"],
        summary="Desactivar producto",
        request=None,
        responses={
            200: ProductDetailSerializer,
        },
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="deactivate",
    )
    def deactivate(self, request, pk=None):
        product = self.get_object()
        product.is_active = False
        product.updated_by = request.user

        product.save(
            update_fields=[
                "is_active",
                "updated_by",
                "updated_at",
            ]
        )

        return Response(
            ProductDetailSerializer(
                product,
                context=self.get_serializer_context(),
            ).data
        )

    @extend_schema(
        tags=["Catálogo - Productos"],
        summary="Activar producto",
        request=None,
        responses={
            200: ProductDetailSerializer,
        },
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="activate",
    )
    def activate(self, request, pk=None):
        product = self.get_object()

        if product.deleted_at:
            return Response(
                {
                    "detail": (
                        "El producto está archivado. "
                        "Primero debe reactivarse."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        product.is_active = True
        product.updated_by = request.user

        product.save(
            update_fields=[
                "is_active",
                "updated_by",
                "updated_at",
            ]
        )

        return Response(
            ProductDetailSerializer(
                product,
                context=self.get_serializer_context(),
            ).data
        )

    @extend_schema(
        tags=["Catálogo - Productos"],
        summary="Reactivar producto archivado",
        request=None,
        responses={
            200: ProductDetailSerializer,
        },
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="restore",
    )
    def restore(self, request, pk=None):
        product = self.get_object()
        product.updated_by = request.user
        product.restore()

        return Response(
            ProductDetailSerializer(
                product,
                context=self.get_serializer_context(),
            ).data
        )

    @extend_schema(
        tags=["Catálogo - Productos"],
        summary="Consultar precio aplicable",
        parameters=[
            OpenApiParameter(
                name="quantity",
                type=int,
                required=True,
                description="Cantidad solicitada.",
            ),
            OpenApiParameter(
                name="price_level",
                type=str,
                required=True,
                description="UUID del nivel de precio.",
            ),
        ],
        responses={
            200: ProductPriceSerializer,
            400: OpenApiResponse(
                description="Parámetros inválidos.",
            ),
            404: OpenApiResponse(
                description="No existe un precio aplicable.",
            ),
        },
    )
    @action(
        detail=True,
        methods=["get"],
        url_path="applicable-price",
    )
    def applicable_price(self, request, pk=None):
        product = self.get_object()

        try:
            quantity = int(
                request.query_params.get(
                    "quantity",
                    "",
                )
            )
        except ValueError:
            quantity = 0

        price_level = request.query_params.get(
            "price_level",
        )

        if quantity < 1 or not price_level:
            return Response(
                {
                    "detail": (
                        "Debe proporcionar quantity mayor a cero "
                        "y el UUID de price_level."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()

        price = (
            ProductPrice.objects
            .select_related(
                "product",
                "price_level",
            )
            .filter(
                product=product,
                price_level_id=price_level,
                minimum_quantity__lte=quantity,
                is_active=True,
                valid_from__lte=now,
            )
            .filter(
                Q(valid_until__isnull=True)
                | Q(valid_until__gte=now)
            )
            .order_by(
                "-minimum_quantity",
            )
            .first()
        )

        if price is None:
            return Response(
                {
                    "detail": (
                        "No existe un precio aplicable "
                        "para la cantidad indicada."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            ProductPriceSerializer(price).data
        )


@extend_schema_view(
    list=extend_schema(
        tags=["Catálogo - Precios"],
        summary="Listar precios de productos",
    ),
    retrieve=extend_schema(
        tags=["Catálogo - Precios"],
        summary="Consultar precio",
    ),
    create=extend_schema(
        tags=["Catálogo - Precios"],
        summary="Configurar precio por nivel y cantidad",
    ),
    update=extend_schema(
        tags=["Catálogo - Precios"],
        summary="Actualizar precio",
    ),
    partial_update=extend_schema(
        tags=["Catálogo - Precios"],
        summary="Actualizar parcialmente un precio",
    ),
)
class ProductPriceViewSet(
    CatalogPermissionMixin,
    viewsets.ModelViewSet,
):
    queryset = (
        ProductPrice.objects
        .select_related(
            "product",
            "price_level",
            "created_by",
        )
        .all()
    )

    serializer_class = ProductPriceSerializer
    filterset_class = ProductPriceFilter

    search_fields = [
        "product__name",
        "product__sku",
        "price_level__name",
        "price_level__code",
    ]

    ordering_fields = [
        "minimum_quantity",
        "unit_price",
        "valid_from",
        "created_at",
    ]

    ordering = [
        "product",
        "price_level",
        "minimum_quantity",
    ]

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
        )


@extend_schema_view(
    list=extend_schema(
        tags=["Catálogo - Imágenes"],
        summary="Listar imágenes de productos",
    ),
    retrieve=extend_schema(
        tags=["Catálogo - Imágenes"],
        summary="Consultar imagen",
    ),
    create=extend_schema(
        tags=["Catálogo - Imágenes"],
        summary="Registrar imagen de producto",
        description=(
            "La solicitud debe enviarse como multipart/form-data."
        ),
    ),
    update=extend_schema(
        tags=["Catálogo - Imágenes"],
        summary="Actualizar imagen",
    ),
    partial_update=extend_schema(
        tags=["Catálogo - Imágenes"],
        summary="Actualizar parcialmente una imagen",
    ),
    destroy=extend_schema(
        tags=["Catálogo - Imágenes"],
        summary="Eliminar imagen",
    ),
)
class ProductImageViewSet(
    CatalogPermissionMixin,
    viewsets.ModelViewSet,
):
    queryset = (
        ProductImage.objects
        .select_related("product")
        .all()
    )

    serializer_class = ProductImageSerializer

    parser_classes = [
        MultiPartParser,
        FormParser,
    ]

    filterset_fields = [
        "product",
        "is_primary",
    ]

    ordering_fields = [
        "position",
        "created_at",
    ]

    ordering = [
        "product",
        "-is_primary",
        "position",
    ]
