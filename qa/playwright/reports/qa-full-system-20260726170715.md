# Informe QA E2E — CRM IDESEM

## Resumen

- Ejecución: `20260726170715`
- Inicio: 2026-07-26T17:07:15.748Z
- Fin: 2026-07-26T17:07:51.391Z
- Frontend: http://localhost:5173
- API: http://localhost:8000/api/v1
- Navegador: Chromium (Playwright)
- Resultado: **APROBADO**
- Casos aprobados: 20
- Casos fallidos: 0

## Casos ejecutados

| ID | Caso | Resultado | Duración | Evidencia |
| --- | --- | --- | ---: | --- |
| QA-AUTH-001 | Inicio de sesión administrativo y carga del panel | APROBADO | 1.11 s | Sesión iniciada como demo_admin; 68 permisos efectivos. |
| QA-CAT-001 | Crear una categoría de productos | APROBADO | 0.76 s | Categoría QA Herramientas 0726170715 creada con id e77cdf2a-bbad-401b-a11d-a8533260a331. |
| QA-PRICE-001 | Crear nivel de precio y regla automática desde tres unidades | APROBADO | 2.02 s | Nivel QA Preferencial 0726170715 y regla x3 creados. |
| QA-INV-001 | Crear un almacén activo | APROBADO | 0.68 s | Almacén QA Almacén 0726170715 creado con id 29d9523b-4eeb-4ef1-9f66-e414caa6e49d. |
| QA-PROD-001 | Crear primer producto con precio normal | APROBADO | 2.39 s | Producto QA Taladro 0726170715 creado a Bs 20.00. |
| QA-PROD-002 | Crear segundo producto con precio normal | APROBADO | 1.51 s | Producto QA Sierra 0726170715 creado a Bs 35.00. |
| QA-PRICE-002 | Asignar precio especial por cantidad al primer producto | APROBADO | 4.24 s | QA Taladro 0726170715: precio x3 = Bs 15.00. |
| QA-PRICE-003 | Asignar precio especial por cantidad al segundo producto | APROBADO | 4.55 s | QA Sierra 0726170715: precio x3 = Bs 30.00. |
| QA-CLIENT-001 | Crear tipo y cliente asociado al nivel de precio | APROBADO | 0.96 s | Cliente QA Cliente 0726170715 S.R.L. asociado al nivel QA Preferencial 0726170715. |
| QA-INV-002 | Vincular QA Taladro 0726170715 con el almacén | APROBADO | 1.23 s | Existencia vinculada para QA Taladro 0726170715 en QA Almacén 0726170715. |
| QA-INV-004 | Registrar entrada y validar saldo de QA Taladro 0726170715 | APROBADO | 2.14 s | Entrada de 25 unidades; saldo disponible verificado en 25. |
| QA-INV-003 | Vincular QA Sierra 0726170715 con el almacén | APROBADO | 2.00 s | Existencia vinculada para QA Sierra 0726170715 en QA Almacén 0726170715. |
| QA-INV-005 | Registrar entrada y validar saldo de QA Sierra 0726170715 | APROBADO | 1.32 s | Entrada de 12 unidades; saldo disponible verificado en 12. |
| QA-QUOTE-001 | Generar cotización emitida de un producto a precio normal | APROBADO | 1.74 s | COT-000020: 1 producto(s), total Bs 20.00, ahorro Bs 0.00. |
| QA-QUOTE-002 | Generar cotización emitida con varios productos y descuentos automáticos | APROBADO | 3.88 s | COT-000021: 2 producto(s), total Bs 165.00, ahorro Bs 35.00. |
| QA-QUOTE-003 | Validar persistencia, total y estado emitido en el historial | APROBADO | 1.48 s | Historial validado para COT-000020, COT-000021. |
| QA-QUOTE-004 | Generar PDF estándar y papel rollo de la cotización | APROBADO | 0.18 s | standard: 76.8 KiB; roll: 2.6 KiB. |
| QA-RBAC-001 | Validar navegación visible para el perfil Comercial | APROBADO | 1.57 s | Comercial ve operación de ventas y no ve inventario ni administración. |
| QA-RBAC-002 | Validar navegación visible para el perfil Inventario | APROBADO | 1.71 s | Inventario ve catálogo e inventario y no ve ventas ni administración. |
| QA-TECH-001 | Validar ausencia de errores JavaScript y respuestas HTTP 5xx | APROBADO | 0.07 s | Sin errores de página, consola relevantes ni respuestas HTTP 5xx. |

## Datos de prueba creados

- Categoría: QA Herramientas 0726170715 (QACAT0726170715)
- Nivel de precio: QA Preferencial 0726170715, regla desde 3 unidades
- Cliente: QA Cliente 0726170715 S.R.L., asociado a QA Preferencial 0726170715
- Almacén: QA Almacén 0726170715 (QAALM0726170715)
- Productos:
  - QA Taladro 0726170715: normal Bs 20.00, especial Bs 15.00, stock 25
  - QA Sierra 0726170715: normal Bs 35.00, especial Bs 30.00, stock 12

## Señales técnicas observadas

- No se detectaron errores JavaScript, errores de consola ni respuestas HTTP 5xx durante la ejecución principal.

## Evidencias

- Capturas y PDFs: `qa\playwright\artifacts\20260726170715`
- Resultado estructurado: `qa/playwright/reports/latest.json`

