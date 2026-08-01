import os

from django.conf import settings
from django.core.wsgi import get_wsgi_application
from whitenoise import WhiteNoise

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings",
)

application = get_wsgi_application()

# Los archivos cargados por los usuarios también deben estar disponibles en el
# servidor local sin requerir Nginx, Apache ni Docker.
if not settings.DEBUG:
    application = WhiteNoise(
        application,
        root=str(settings.MEDIA_ROOT),
        prefix=settings.MEDIA_URL.lstrip("/"),
    )
