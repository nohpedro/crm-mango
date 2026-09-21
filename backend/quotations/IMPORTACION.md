# Transferencia masiva de cotizaciones

Desde Nueva cotización o Historial, abrir **Importar / Exportar**
(`/quotations/import-export`). Se reutiliza el flujo de clientes: plantilla,
selector de archivo, confirmación, modo parcial/total y reporte de observaciones.
La exportación desde Historial conserva los filtros de búsqueda, cliente y estado.

## Adaptación del archivo de equipos

Descargar la plantilla del sistema. El archivo de referencia original no se carga
directamente, porque describe equipos comprados y tiene otras columnas.

| Referencia original | Plantilla del sistema |
| --- | --- |
| Codigo_cliente | NIT/CI del cliente existente y activo |
| Nombre_cliente | Nombre_cliente, obligatorio y coincidente con el cliente |
| Fecha_compra | Fecha_cotizacion, obligatoria |
| Aparato, Tipo_aparato, Marca, Modelo, Capacidad, Unidad_capacidad, Tipo_gas | SKU del producto existente; Producto sirve de referencia visual |
| Numero_serie | Numero_serie, obligatorio solo para Pagada, una unidad por fila |
| Numero_recibo | Codigo Cotización, código único para agrupar los equipos |
| Precio_unitario_Bs | Precio_unitario_Bs, opcional |
| Observaciones | Observaciones comunes a la cotización |
| — | Estado: Pendiente o Pagada |

El código no sustituye la numeración COT automática. Si no existe un recibo,
asignar un código único a cada cotización. Nunca reutilizar códigos para
crear otra cotización. No inventar fechas ni series: completar la fecha real antes de importar y las series antes de marcar Pagada. Los datos descriptivos del equipo se mantienen en el catálogo.

Repetir código, NIT/CI, fecha, estado y observaciones en todas las filas de la
misma cotización. Se ignoran filas completamente vacías. Fechas: AAAA-MM-DD,
DD/MM/AAAA o celdas de fecha Excel. Formatos: .xlsx y .xls, máximo 15 MB.

Un precio vacío usa las reglas comerciales vigentes considerando todas las
unidades de la cotización. Un precio explícito, incluido cero, requiere el permiso
de edición de precios. Una cotización Pagada requiere cambiar estado o editar
cotizaciones. No se crean clientes ni productos durante la carga.

Parcial guarda únicamente cotizaciones completas válidas. Total no guarda nada si
hay errores. Los contadores cuentan cotizaciones (una fila sin código se
cuenta como rechazo independiente). Para corregir una cotización rechazada,
reenviar todas sus filas. Se rechazan códigos existentes, incluidos los
exportadas, sin modificar las cotizaciones actuales.

## Permisos e instalación

Ejecutar `python manage.py migrate` al desplegar. En Roles, asignar:

- `quotations.import_quotation`: requiere crear cotizaciones y sus dependencias.
- `quotations.export_quotation`: requiere ver cotizaciones.

Los administradores conservan su acceso completo. No se amplían automáticamente
los permisos de los demás roles. La plantilla admite cualquiera de los dos
permisos; el reporte requiere importar.

Endpoints bajo `/api/v1/quotations/`: GET `template/`, GET `export/`, POST
`import/` (multipart: `file`, `mode`) y POST `report/` (JSON: `errors`).
