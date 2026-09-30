# Backup del sistema

Abrir **Administración → Configuración**. Solo superusuarios y usuarios con rol
ADMIN activo pueden usar los endpoints y la pantalla.

- **Generar y descargar backup** crea un ZIP con todos los datos disponibles al
  exportar, incluidos usuarios, hashes de contraseñas, roles, permisos, precios,
  existencias, movimientos, clientes, cotizaciones, plantillas e imágenes referenciadas.
- **Revisar backup** comprueba compatibilidad, integridad y relaciones en una base
  SQLite temporal, sin modificar los datos actuales. Muestra la fecha del archivo
  y cantidades por módulo.
- **Restaurar y reemplazar datos** exige escribir `RESTAURAR`. Sustituye todos los
  registros por los del archivo; no combina datos. Después hay que iniciar sesión
  con las credenciales de una cuenta del backup.

El ZIP es privado y no está cifrado: almacenarlo con acceso restringido. Los hashes
de integridad detectan daños, no certifican quién creó el respaldo. Restaurar solo
archivos de confianza.

## Alcance y compatibilidad

Implementado para SQLite, que es el motor configurado en este proyecto. Requiere
exactamente el mismo esquema de tablas e índices; aplicar versiones/migraciones
distintas puede volver incompatible un archivo. Conserva identificadores, fechas
y contadores. Incluye también registros inactivos y eliminados lógicamente.

No incluye código, `.env`, secretos, migraciones, registros del admin de Django,
sesiones ni tokens. Las imágenes se copian a una nueva carpeta dentro de MEDIA_ROOT
y las referencias absolutas de las plantillas se adaptan al servidor de destino.
Los archivos anteriores se conservan; una operación fallida puede dejar imágenes
preparadas sin referencias, pero no sobrescribe imágenes actuales.

Límites: 100 MB comprimidos, 300 MB descomprimidos y 10.000 entradas ZIP. Para bases
mayores se requiere respaldo operativo del servidor. El proxy debe permitir
archivos de hasta 100 MB y tiempos de hasta 300 segundos para estas rutas.

## Restauración y recuperación

Restaurar durante una ventana sin otros usuarios trabajando. SQLite bloquea las
escrituras mientras reemplaza los datos. Un error revierte la transacción completa.
Antes de borrar registros se genera un ZIP del estado actual en `backend/backups/`
o en `settings.BACKUP_ROOT`; esta carpeta debe estar fuera de MEDIA_ROOT y de toda
carpeta pública. Si no se puede crear esta copia, la restauración no continúa.

La respuesta devuelve el nombre `before-restore-…zip`. Para recuperar el estado
anterior, el administrador del servidor obtiene ese archivo y lo carga mediante
la misma pantalla. Estas copias no se borran automáticamente: revisar el espacio
y conservarlas según la política de la organización.

Se cierran las sesiones de Django y se invalidan los refresh tokens actuales. Los
access tokens JWT ya emitidos caducan según su duración configurada (15 minutos por
defecto). La pantalla limpia la sesión del operador al finalizar. Ante un corte
de conexión, comprobar el estado del sistema antes de repetir la restauración.

## API

- `GET /api/v1/settings/backup/export/`: ZIP sin caché.
- `POST /api/v1/settings/backup/import/`: multipart `file`, `action=validate`.
- Misma ruta con `action=restore`, `confirmation=RESTAURAR`: restauración completa.

Pruebas: `python manage.py test idesem.test_backup`.
