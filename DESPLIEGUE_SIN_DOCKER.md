# CRM IDESEM sin Docker (Windows)

El CRM queda disponible desde una sola URL para toda la red local:

```text
http://NOMBRE-DEL-EQUIPO:8000
```

La dirección no depende de la IP entregada por el router. Se mantendrá igual
mientras no se cambie el nombre de la computadora que funciona como servidor.

## Configurar la dirección permanente

La dirección y el puerto se configuran en:

```text
production/config.psd1
```

La configuración inicial es:

```powershell
@{
    HostName = "auto"
    Port = 8000
    OpenBrowser = $true
}
```

Con `HostName = "auto"`, el sistema usa automáticamente el nombre de Windows.
Por ejemplo, si el equipo se llama `CRM-IDESEM`, la dirección permanente será
`http://crm-idesem:8000`.

También puedes escribir `HostName = "crm-idesem"`, pero el nombre configurado y
el nombre real de la computadora deben coincidir para que los demás equipos de
la red puedan encontrarla. El iniciador mostrará una advertencia si no coinciden.

## Requisitos de la computadora

- Windows 10 u 11 de 64 bits.
- Una cuenta de Windows con permiso de administrador durante la configuración.
- Conexión a Internet durante la primera instalación.
- Windows Package Manager (`winget`), incluido normalmente con **Instalador de
  aplicaciones** de Microsoft Store.
- Al menos 4 GB de memoria RAM y 2 GB de espacio disponible.
- La red de Windows debe estar configurada como **Privada**.

No se requiere Docker, PostgreSQL, Nginx ni Apache. Esta instalación utiliza la
base SQLite persistente ubicada en `backend/db.sqlite3` y Waitress como servidor
de producción local.

El botón de configuración comprueba e instala automáticamente, cuando sea
necesario:

- Python 3.12.
- Node.js LTS.
- Dependencias Python del servidor.
- Dependencias y compilación de la interfaz web.

No es necesario instalar Git, Visual Studio Code ni herramientas para bases de
datos. Si `winget` no está disponible, instala **Instalador de aplicaciones**
desde Microsoft Store y ejecuta nuevamente el configurador.

## Primera configuración

1. Copia toda la carpeta del proyecto a una ubicación permanente de la
   computadora servidor, por ejemplo `C:\CRM-IDESEM`. Evita ejecutarla desde un
   archivo ZIP, una memoria USB o una carpeta sincronizada por OneDrive.
2. Haz doble clic en `Configurar CRM IDESEM.bat`.
3. Acepta el permiso de administrador. Solo se utiliza para permitir el puerto
   8000 en el firewall de redes privadas.
4. Mantén la conexión a Internet y espera hasta que aparezca el mensaje
   **Configuración terminada correctamente**.

El configurador crea el entorno virtual, instala las dependencias, compila la
interfaz, aplica las migraciones y carga únicamente las semillas idempotentes del
sistema. No elimina ni reemplaza datos existentes.

## Inicio diario

Haz doble clic en `Iniciar CRM IDESEM.bat`. Este único archivo inicia
automáticamente el backend y el frontend. El frontend se sirve desde el mismo
host y puerto que la API; no se debe ejecutar `npm run dev` ni abrir el puerto
5173 en producción.

Después de completar la primera configuración no se necesita Internet para
trabajar dentro de la red local. La ventana de **Iniciar CRM IDESEM** debe
permanecer abierta mientras se utiliza el sistema.

Se abrirá el navegador de la computadora principal y el CRM quedará disponible
para los demás equipos usando la URL mostrada en la consola.

La URL también queda guardada en:

```text
production/runtime/url-red-local.txt
```

La ventana debe permanecer abierta. Para detener el CRM, presiona `Ctrl+C` o
cierra esa ventana.

## Actualizar el sistema sin Git

Deten el CRM y haz doble clic en `Actualizar CRM IDESEM.bat`, ubicado en la
carpeta raiz del proyecto. El actualizador descarga directamente la rama
`produccion` de `nohpedro/crm-mango`; no requiere Git ni vuelve a instalar el
proyecto desde cero.

La actualizacion agrega y reemplaza archivos, pero no elimina archivos locales.
Conserva expresamente la base `backend/db.sqlite3`, el contenido de
`backend/media/`, las variables `.env`, `production/config.psd1` y los secretos
de `production/runtime/`. Despues actualiza las dependencias, compila la interfaz
y aplica las migraciones de Django.

Antes de reemplazar archivos guarda una copia en:

```text
production/runtime/backups/pre-update-FECHA-HORA/
```

El resultado de la ultima actualizacion queda registrado en
`production/runtime/last-update.txt`.

## Mantener siempre la misma URL

Antes de entregar el sistema, asigna un nombre definitivo a la computadora, por
ejemplo `CRM-IDESEM`, desde **Configuración de Windows > Sistema > Información >
Cambiar el nombre de este equipo**. Después del reinicio, la URL será:

```text
http://crm-idesem:8000
```

No es necesario reservar una IP. Si algún equipo antiguo no puede resolver el
nombre, se recomienda reservar la IP del servidor en el router como alternativa.

## Copias de seguridad

Con el CRM detenido, copia estos elementos a una unidad externa:

- `backend/db.sqlite3`
- `backend/media/`
- `production/runtime/secret-key.txt`

Restaurar esos tres elementos conserva los registros, imágenes y sesiones del
sistema.
