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

## Frontend

El frontend estará ubicado en la carpeta:

```text
frontend/
```

Su implementación se realizará posteriormente.