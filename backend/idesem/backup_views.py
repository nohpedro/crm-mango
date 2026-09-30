from django.http import HttpResponse
from django.db import DatabaseError
from django.utils import timezone
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from users.permissions import IsAdministrator
from .backup import MAX_UPLOAD, export_backup, restore_backup, summary, validate_backup


class BackupExportView(APIView):
    permission_classes = [IsAdministrator]

    def get(self, request):
        try:
            content = export_backup()
        except (ValueError, OSError, DatabaseError) as exc:
            return Response({'detail': str(exc) if isinstance(exc, ValueError) else 'No se pudo generar el backup. Revisa el almacenamiento del servidor.'}, status=400)
        response = HttpResponse(content, content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="IDESEM-backup-{timezone.now():%Y%m%d-%H%M%S}.zip"'
        response['Cache-Control'] = 'no-store'
        return response


class BackupImportView(APIView):
    permission_classes = [IsAdministrator]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        upload = request.FILES.get('file')
        action = request.data.get('action', 'validate')
        if not upload or upload.size > MAX_UPLOAD or not upload.name.lower().endswith('.zip'):
            return Response({'detail': 'Selecciona un backup .zip de hasta 100 MB.'}, status=400)
        if action not in {'validate', 'restore'}:
            return Response({'detail': 'Acción de backup inválida.'}, status=400)
        if action == 'restore' and request.data.get('confirmation') != 'RESTAURAR':
            return Response({'detail': 'Escribe RESTAURAR para confirmar el reemplazo completo.'}, status=400)
        try:
            raw = upload.read()
            result = restore_backup(raw) if action == 'restore' else summary(*validate_backup(raw))
            return Response(result)
        except (ValueError, OSError, DatabaseError) as exc:
            return Response({'detail': str(exc) if isinstance(exc, ValueError) else 'No se pudo completar la operación. Los cambios de datos se revirtieron; revisa el almacenamiento o intenta cuando no haya otras operaciones.'}, status=400)
