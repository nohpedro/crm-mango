import hashlib
import json
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from zipfile import ZipFile, ZIP_DEFLATED

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.test import override_settings
from rest_framework.test import APITestCase

from inventory.models import Warehouse
from quotations.models import Quotation
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from .backup import export_backup, validate_backup


class BackupTests(APITestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.settings_override = override_settings(MEDIA_ROOT=self.root / 'media', BACKUP_ROOT=self.root / 'backups')
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.user = get_user_model().objects.create_superuser(username='backupadmin', email='backup@example.com', password='test-password')
        self.client.force_authenticate(self.user)
        self.warehouse = Warehouse.objects.create(name='Principal', code='MAIN')

    def upload(self, raw, action='validate', confirmation=''):
        return self.client.post('/api/v1/settings/backup/import/', {'file': SimpleUploadedFile('backup.zip', raw), 'action': action, 'confirmation': confirmation}, format='multipart')

    def alter(self, raw, change):
        with ZipFile(BytesIO(raw)) as archive:
            files = {name: archive.read(name) for name in archive.namelist()}
        manifest, data = json.loads(files['manifest.json']), json.loads(files['data.json'])
        change(manifest, data)
        files['data.json'] = json.dumps(data).encode()
        manifest['data_sha256'] = hashlib.sha256(files['data.json']).hexdigest()
        files['manifest.json'] = json.dumps(manifest).encode()
        output = BytesIO()
        with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
            for name, content in files.items():
                archive.writestr(name, content)
        return output.getvalue()

    def test_export_preview_and_restore_replaces_new_records(self):
        token = RefreshToken.for_user(self.user)
        response = self.client.get('/api/v1/settings/backup/export/')
        self.assertEqual(response.status_code, 200, response.content[:200])
        raw = response.content
        Warehouse.objects.create(name='Posterior', code='NEW')
        preview = self.upload(raw)
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(preview.data['counts']['Almacenes'], 1)
        self.assertEqual(Warehouse.objects.count(), 2)
        self.assertEqual(self.upload(raw, 'restore').status_code, 400)
        restored = self.upload(raw, 'restore', 'RESTAURAR')
        self.assertEqual(restored.status_code, 200, restored.data)
        self.assertEqual(Warehouse.objects.count(), 1)
        self.assertTrue(BlacklistedToken.objects.filter(token__jti=token['jti']).exists())
        self.assertTrue(get_user_model().objects.get(pk=self.user.pk).check_password('test-password'))
        recovery = self.root / 'backups' / restored.data['recovery_file']
        self.assertTrue(recovery.is_file())
        self.assertEqual(len(validate_backup(recovery.read_bytes())[1]['inventory_warehouse']['rows']), 2)

    def test_media_snapshot_paths_are_portable_and_can_be_exported_again(self):
        image = self.root / 'media' / 'test.png'
        image.parent.mkdir(parents=True)
        image.write_bytes(b'image-content')
        quotation = Quotation.objects.create(client_name='Cliente', template_snapshot={'images': [{'path': str(image), 'id': 1}]})
        raw = export_backup()
        response = self.upload(raw, 'restore', 'RESTAURAR')
        self.assertEqual(response.status_code, 200, response.data)
        quotation.refresh_from_db()
        restored_path = Path(quotation.template_snapshot['images'][0]['path'])
        self.assertNotEqual(restored_path, image)
        self.assertEqual(restored_path.read_bytes(), b'image-content')
        validate_backup(export_backup())

    def test_admin_only_and_corrupt_archives_rejected(self):
        self.assertEqual(self.upload(b'bad').status_code, 400)
        raw = export_backup()
        incompatible = self.alter(raw, lambda manifest, data: manifest.update(schema='other'))
        self.assertEqual(self.upload(incompatible).status_code, 400)
        missing_admin = self.alter(raw, lambda manifest, data: data['users_user'].update(rows=[]))
        self.assertEqual(self.upload(missing_admin).status_code, 400)
        ordinary = get_user_model().objects.create_user(username='ordinary', email='ordinary@example.com')
        self.client.force_authenticate(ordinary)
        self.assertEqual(self.client.get('/api/v1/settings/backup/export/').status_code, 403)
        self.assertEqual(self.upload(raw, 'restore', 'RESTAURAR').status_code, 403)

    def test_transaction_failure_preserves_current_data(self):
        raw = export_backup()
        Warehouse.objects.create(name='Posterior', code='NEW')
        with patch('idesem.backup.connection.check_constraints', side_effect=IntegrityError('test failure')):
            response = self.upload(raw, 'restore', 'RESTAURAR')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Warehouse.objects.count(), 2)

    def test_zip_traversal_and_missing_tables_rejected(self):
        raw = export_backup()
        missing = self.alter(raw, lambda manifest, data: data.pop('inventory_warehouse'))
        self.assertEqual(self.upload(missing).status_code, 400)
        output = BytesIO(raw)
        with ZipFile(output, 'a') as archive:
            archive.writestr('../outside.txt', b'bad')
        self.assertEqual(self.upload(output.getvalue()).status_code, 400)
        self.assertFalse((self.root / 'outside.txt').exists())

    def test_recovery_failure_does_not_replace_data(self):
        raw = export_backup()
        Warehouse.objects.create(name='Posterior', code='NEW')
        with patch('idesem.backup.export_backup', side_effect=OSError('disk full')):
            response = self.upload(raw, 'restore', 'RESTAURAR')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Warehouse.objects.count(), 2)

    def test_sequences_and_original_timestamps_are_restored(self):
        first = Quotation.objects.create(client_name='Original')
        raw = export_backup()
        Quotation.objects.create(client_name='Posterior')
        response = self.upload(raw, 'restore', 'RESTAURAR')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Quotation.objects.get(pk=first.pk).created_at, first.created_at)
        next_quotation = Quotation.objects.create(client_name='Nueva')
        self.assertEqual(next_quotation.pk, first.pk + 1)

    def test_broken_foreign_key_is_rejected_before_restore(self):
        quotation = Quotation.objects.create(client_name='Original', created_by=self.user)
        raw = export_backup()
        def break_relation(manifest, data):
            table = data['quotations_quotation']
            table['rows'][0][table['columns'].index('created_by_id')] = 'missing-user'
        response = self.upload(self.alter(raw, break_relation), 'restore', 'RESTAURAR')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(Quotation.objects.filter(pk=quotation.pk, created_by=self.user).exists())
