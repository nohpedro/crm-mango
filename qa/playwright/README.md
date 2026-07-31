# QA E2E con Playwright

La prueba `full-system.qa.cjs` recorre el CRM desde la interfaz y valida la
persistencia mediante la API. Cada ejecución crea datos identificables con el
prefijo `QA`, toma capturas ante fallos y genera informes Markdown/JSON.

## Cobertura

- Autenticación administrativa.
- Categorías, niveles de precio y reglas por cantidad.
- Almacenes, productos, existencias y entradas de stock.
- Tipos de cliente y clientes asociados a un nivel de precio.
- Cotización de un producto a precio normal.
- Cotización de varios productos con precios especiales automáticos.
- Estado emitido, historial, totales, ahorro y persistencia.
- PDF en hoja estándar y papel rollo.
- Visibilidad del sidebar para perfiles Comercial e Inventario.
- Errores JavaScript, consola y respuestas HTTP 5xx.

## Ejecución

Con frontend y backend activos, usa el ejecutor de Windows:

```powershell
.\qa\playwright\run-full-system.cmd
```

Para observar la ejecución:

```powershell
.\qa\playwright\run-full-system.cmd -Headed -SlowMo 150
```

Se pueden indicar otras URLs o credenciales:

```powershell
.\qa\playwright\run-full-system.cmd `
  -FrontendUrl "http://localhost:5173" `
  -ApiUrl "http://localhost:8000/api/v1" `
  -Username "demo_admin" `
  -Password "Demo12345!"
```

Los resultados quedan en:

- `qa/playwright/reports/latest.md`
- `qa/playwright/reports/latest.json`
- `qa/playwright/artifacts/<id-de-ejecución>/`
