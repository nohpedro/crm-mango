# CRM IDESEM

Sistema CRM desarrollado para la gestión comercial de IDESEM.

## Estructura del proyecto

```text
crm-idesem/
├── backend/
├── frontend/
├── .gitignore
└── README.md
```

## Backend

El backend está desarrollado con:

- Python
- Django
- Django REST Framework
- PostgreSQL
- Docker
- JWT
- Swagger/OpenAPI

Para ejecutar el backend:

```bash
cd backend
docker compose up -d --build
```

Swagger:

```text
http://localhost:8000/api/docs/
```

Django Admin:

```text
http://localhost:8000/admin/
```

### Datos semilla

Al iniciar el backend con Docker se cargan de forma idempotente el almacén
`Principal`, los niveles `Mayorista`, `Minorista` y `Preferencial`, los roles
del sistema y los usuarios `admin`, `cajero`, `inventarios` y
`configuraciones`.

La contraseña inicial de las cuentas nuevas es `Demo12345!`. También se puede
ejecutar manualmente:

```bash
cd backend
python manage.py seed_system_data
```

El comando no duplica registros ni reemplaza la contraseña de una cuenta que
ya existe. Para restablecer las contraseñas de prueba:

```bash
python manage.py seed_system_data --reset-passwords
```

### Datos masivos para pruebas manuales

El comando de carga completa la base activa hasta alcanzar:

- 50 productos.
- 50 existencias y 50 movimientos de inventario.
- 50 cotizaciones emitidas, con entre 1 y 8 productos.
- 10 almacenes.

Las cotizaciones se distribuyen en los últimos 120 días y los productos de
carga incluyen precios especiales desde 3 unidades. Los registros nuevos se
identifican con el prefijo `CARGA-QA`.

```bash
cd backend
python manage.py seed_load_test_data
```

El comando es idempotente: puede ejecutarse nuevamente sin duplicar los datos.
Para probar un volumen mayor:

```bash
python manage.py seed_load_test_data --products 100 --quotations 100
```

## Frontend

El frontend se encuentra en la carpeta:

```text
frontend/
```
