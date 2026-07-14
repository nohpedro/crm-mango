# CRM IDESEM — Frontend

Frontend administrativo desarrollado con React, TypeScript y Vite.

## Requisitos

- Node.js LTS
- Backend de CRM IDESEM disponible

## Configuración local

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

La variable `VITE_API_URL` define la URL base de Django REST Framework.

## Verificación

```powershell
npm run lint
npm run format:check
npm run test
npm run build
```
