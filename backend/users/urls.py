from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CurrentUserAPIView,
    LoginAPIView,
    LogoutAPIView,
    PermissionListAPIView,
    RefreshAPIView,
    RoleViewSet,
    UserViewSet,
)


router = DefaultRouter()

router.register(
    prefix="roles",
    viewset=RoleViewSet,
    basename="role",
)

router.register(
    prefix="users",
    viewset=UserViewSet,
    basename="user",
)


urlpatterns = [
    path(
        "auth/login/",
        LoginAPIView.as_view(),
        name="auth-login",
    ),
    path(
        "auth/refresh/",
        RefreshAPIView.as_view(),
        name="auth-refresh",
    ),
    path(
        "auth/logout/",
        LogoutAPIView.as_view(),
        name="auth-logout",
    ),
    path(
        "auth/me/",
        CurrentUserAPIView.as_view(),
        name="auth-me",
    ),
    path(
        "permissions/",
        PermissionListAPIView.as_view(),
        name="permission-list",
    ),
    path(
        "",
        include(router.urls),
    ),
]