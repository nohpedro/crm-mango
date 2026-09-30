"""Versioned SQLite data archives; never execute SQL supplied by an archive."""
import hashlib
import json
import sqlite3
import uuid
import math
import zlib
from io import BytesIO
from pathlib import Path, PurePosixPath
from zipfile import BadZipFile, ZipFile, ZIP_DEFLATED

from django.apps import apps
from django.conf import settings
from django.db import connection, transaction
from django.db.models import FileField
from django.utils import timezone

MAX_UPLOAD = 100 * 1024 * 1024
MAX_EXPANDED = 300 * 1024 * 1024
EXCLUDED = {"django_migrations", "django_session", "django_admin_log"}


def schema():
    if connection.vendor != "sqlite":
        raise ValueError("Esta versión de respaldo requiere la base de datos SQLite del sistema.")
    with connection.cursor() as cursor:
        cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        tables = {name: sql for name, sql in cursor.fetchall() if name not in EXCLUDED and not name.startswith("token_blacklist_")}
        cursor.execute("SELECT tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name")
        indexes = [sql for table, sql in cursor.fetchall() if table in tables]
    signature = hashlib.sha256(json.dumps([tables, indexes], sort_keys=True).encode()).hexdigest()
    return tables, indexes, signature


def safe_name(value):
    if not isinstance(value, str) or not value or '\\' in value or ':' in value or '\x00' in value:
        raise ValueError("El respaldo contiene una ruta de archivo no válida.")
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in {'..', '.'} for part in value.split('/')):
        raise ValueError("El respaldo contiene una ruta de archivo no válida.")
    return value


def file_references(data):
    """Yield mutable database row locations for files and snapshot image paths."""
    for model in apps.get_models():
        table = data.get(model._meta.db_table)
        if not table:
            continue
        for field in model._meta.fields:
            if isinstance(field, FileField):
                index = table['columns'].index(field.column)
                for row in table['rows']:
                    if row[index]:
                        yield row, index, row[index], False
    table = data.get('quotations_quotation')
    if table and 'template_snapshot' in table['columns']:
        index = table['columns'].index('template_snapshot')
        for row in table['rows']:
            snapshot = json.loads(row[index] or '{}')
            for entry in snapshot.get('images', []):
                if entry.get('path'):
                    yield entry, 'path', entry['path'], True
            row[index] = json.dumps(snapshot, ensure_ascii=False)


def media_relative(value, absolute, media_root):
    if absolute:
        root = str(media_root).replace('\\', '/').rstrip('/') + '/'
        normalized = value.replace('\\', '/')
        if not normalized.casefold().startswith(root.casefold()) and Path(media_root).exists():
            normalized = str(Path(value).resolve()).replace('\\', '/')
            root = str(Path(media_root).resolve()).replace('\\', '/').rstrip('/') + '/'
        if not normalized.casefold().startswith(root.casefold()):
            raise ValueError("Una imagen del documento está fuera del directorio de medios.")
        value = normalized[len(root):]
    return safe_name(value)


def export_backup():
    tables, _, signature = schema()
    data = {}
    with transaction.atomic(), connection.cursor() as cursor:
        for table in tables:
            cursor.execute(f'SELECT * FROM {connection.ops.quote_name(table)}')
            data[table] = {'columns': [column[0] for column in cursor.description], 'rows': [list(row) for row in cursor.fetchall()]}
        cursor.execute('SELECT name, seq FROM sqlite_sequence')
        sequences = {name: seq for name, seq in cursor.fetchall() if name in tables}
        root = Path(settings.MEDIA_ROOT).resolve()
        names = set()
        for container, key, value, absolute in file_references(data):
            relative = media_relative(value, absolute, root)
            names.add(relative)
            if absolute:
                container[key] = str(root / relative)
        raw = json.dumps(data, ensure_ascii=False, default=str).encode('utf-8')
        total = len(raw)
        media = {}
        for name in sorted(names):
            path = (root / name).resolve()
            if not path.is_relative_to(root) or not path.is_file():
                raise ValueError(f"No se encontró una imagen necesaria para el respaldo: {name}")
            total += path.stat().st_size
            if total > MAX_EXPANDED:
                raise ValueError("El respaldo supera 300 MB; solicita un respaldo al administrador del servidor.")
            media[name] = path.read_bytes()
        if total > MAX_EXPANDED:
            raise ValueError("El respaldo supera 300 MB.")
        manifest = {
            'format': 'idesem-backup', 'version': 1, 'created_at': timezone.now().isoformat(),
            'schema': signature, 'media_root': str(root),
            'sequences': sequences,
            'data_sha256': hashlib.sha256(raw).hexdigest(),
            'files': {name: hashlib.sha256(content).hexdigest() for name, content in media.items()},
        }
        manifest_content = json.dumps(manifest).encode('utf-8')
        if len(media) + 2 > 10000 or total + len(manifest_content) > MAX_EXPANDED:
            raise ValueError("El respaldo supera los límites de tamaño o cantidad de archivos.")
        output = BytesIO()
        with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
            archive.writestr('manifest.json', manifest_content)
            archive.writestr('data.json', raw)
            for name, content in media.items():
                archive.writestr('media/' + name, content)
    if output.tell() > MAX_UPLOAD:
        raise ValueError("El respaldo comprimido supera 100 MB.")
    return output.getvalue()


def validate_backup(raw):
    if len(raw) > MAX_UPLOAD:
        raise ValueError("El archivo no puede superar 100 MB.")
    tables, indexes, signature = schema()
    try:
        with ZipFile(BytesIO(raw)) as archive:
            entries = archive.infolist()
            if len(entries) > 10000 or sum(item.file_size for item in entries) > MAX_EXPANDED:
                raise ValueError("El respaldo supera los límites de tamaño o cantidad de archivos.")
            names = [safe_name(item.filename) for item in entries]
            if len(names) != len(set(names)):
                raise ValueError("El archivo contiene entradas duplicadas.")
            manifest = json.loads(archive.read('manifest.json'))
            if manifest['format'] != 'idesem-backup' or manifest['version'] != 1 or manifest['schema'] != signature:
                raise ValueError("El respaldo no es compatible con esta versión del sistema.")
            created = timezone.datetime.fromisoformat(manifest['created_at'])
            if not timezone.is_aware(created):
                raise ValueError("La fecha del respaldo no es válida.")
            content = archive.read('data.json')
            if hashlib.sha256(content).hexdigest() != manifest['data_sha256']:
                raise ValueError("Los datos del respaldo están dañados.")
            data = json.loads(content)
            if set(data) != set(tables):
                raise ValueError("El respaldo no incluye todas las tablas requeridas.")
            if not isinstance(manifest['sequences'], dict) or any(name not in tables or not isinstance(value, int) or value < 0 for name, value in manifest['sequences'].items()):
                raise ValueError("Los contadores del respaldo no son válidos.")
            media = {}
            if set(names) != {'manifest.json', 'data.json'} | {'media/' + safe_name(name) for name in manifest['files']}:
                raise ValueError("El contenido del archivo no coincide con su manifiesto.")
            for name, digest in manifest['files'].items():
                media[name] = archive.read('media/' + name)
                if hashlib.sha256(media[name]).hexdigest() != digest:
                    raise ValueError("Una imagen del respaldo está dañada.")
            # Use our current trusted schema, never schema/SQL from the uploaded file.
            with sqlite3.connect(':memory:') as staged:
                for sql in tables.values():
                    staged.execute(sql)
                for sql in indexes:
                    staged.execute(sql)
                for table, payload in data.items():
                    columns = [row[1] for row in staged.execute(f'PRAGMA table_info("{table}")')]
                    if payload['columns'] != columns or not isinstance(payload['rows'], list):
                        raise ValueError("Las columnas del respaldo no son compatibles.")
                    if any(not isinstance(row, list) or len(row) != len(columns) or any((value is not None and not isinstance(value, (str, int, float))) or (isinstance(value, float) and not math.isfinite(value)) for value in row) for row in payload['rows']):
                        raise ValueError("El respaldo contiene registros inválidos.")
                    staged.executemany(f'INSERT INTO "{table}" VALUES ({",".join("?" for _ in columns)})', payload['rows'])
                if staged.execute('PRAGMA foreign_key_check').fetchone():
                    raise ValueError("El respaldo contiene relaciones incompletas.")
                if not staged.execute("SELECT 1 FROM users_user u LEFT JOIN users_role r ON u.role_id=r.id WHERE u.is_active=1 AND (u.is_superuser=1 OR (r.code='ADMIN' AND r.is_active=1)) LIMIT 1").fetchone():
                    raise ValueError("El respaldo debe incluir al menos un administrador activo.")
            for _, _, value, absolute in file_references(data):
                if media_relative(value, absolute, manifest['media_root']) not in media:
                    raise ValueError("Falta una imagen referenciada en el respaldo.")
            return manifest, data, media
    except ValueError:
        raise
    except (BadZipFile, KeyError, TypeError, AttributeError, sqlite3.Error, RuntimeError, UnicodeError, OverflowError, zlib.error) as exc:
        raise ValueError("El archivo no es un respaldo IDESEM válido o está dañado.") from exc


def summary(manifest, data, media):
    labels = {
        'clients_client': 'Clientes', 'products_product': 'Productos',
        'quotations_quotation': 'Cotizaciones', 'quotations_quotationitem': 'Productos cotizados',
        'inventory_warehouse': 'Almacenes', 'inventory_stock': 'Existencias',
        'inventory_stockmovement': 'Movimientos', 'users_user': 'Usuarios', 'users_role': 'Roles',
    }
    return {'created_at': manifest['created_at'], 'images': len(media), 'counts': {label: len(data[table]['rows']) for table, label in labels.items()}}


def restore_backup(raw):
    manifest, data, media = validate_backup(raw)
    # Images are staged in a new directory; a failed transaction cannot overwrite
    # files used by current records. Old files are retained for recovery.
    root = Path(settings.MEDIA_ROOT).resolve()
    prefix = 'restored/' + uuid.uuid4().hex
    for name, content in media.items():
        destination = (root / prefix / name).resolve()
        if not destination.is_relative_to(root):
            raise ValueError("Ruta de imagen inválida.")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
    for container, key, value, absolute in file_references(data):
        relative = media_relative(value, absolute, manifest['media_root'])
        container[key] = str(root / prefix / relative) if absolute else prefix + '/' + relative
    with transaction.atomic(), connection.cursor() as cursor:
        cursor.execute('PRAGMA defer_foreign_keys = ON')
        # Acquire the database write lock before making the recovery snapshot.
        cursor.execute('UPDATE users_user SET is_active=is_active WHERE 0')
        recovery = export_backup()
        directory = Path(getattr(settings, 'BACKUP_ROOT', settings.BASE_DIR / 'backups')).resolve()
        if directory.is_relative_to(root):
            raise ValueError("La carpeta de backups debe estar fuera del directorio público de imágenes.")
        directory.mkdir(parents=True, exist_ok=True)
        name = f'before-restore-{timezone.now():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:8]}.zip'
        (directory / name).write_bytes(recovery)
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
        for token in OutstandingToken.objects.all():
            BlacklistedToken.objects.get_or_create(token=token)
        OutstandingToken.objects.update(user=None)
        cursor.execute('DELETE FROM django_admin_log')
        cursor.execute('DELETE FROM django_session')
        for table in data:
            cursor.execute(f'DELETE FROM {connection.ops.quote_name(table)}')
        for table, payload in data.items():
            placeholders = ','.join('%s' for _ in payload['columns'])
            cursor.executemany(f'INSERT INTO {connection.ops.quote_name(table)} VALUES ({placeholders})', payload['rows'])
        for table in data:
            cursor.execute('DELETE FROM sqlite_sequence WHERE name=%s', [table])
        for table, sequence in manifest['sequences'].items():
            cursor.execute('INSERT INTO sqlite_sequence(name, seq) VALUES (%s, %s)', [table, sequence])
        connection.check_constraints()
        from django.contrib.contenttypes.models import ContentType
        transaction.on_commit(ContentType.objects.clear_cache)
    return {'detail': 'Respaldo restaurado. Inicia sesión con una cuenta del backup.', 'recovery_file': name, **summary(manifest, data, media)}
