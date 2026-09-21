import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, FileUp, Info, LoaderCircle, X } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '../../../components/common/ConfirmDialog'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { transferService } from '../services/transfer.service'
import type { ImportMode, ImportResult, TransferResource } from '../types/transfer.types'
import { useAuthStore } from '../../../store/authStore'
import { hasPermission } from '../../../utils/permissions'

interface DataTransferPanelProps {
  resource: TransferResource
  filters?: Record<string, string | number | boolean | undefined>
}

const templateFields: Record<
  TransferResource,
  { title: string; required: string[]; optional: string[]; note?: string }
> = {
  quotations: {
    title: 'Plantilla de cotizaciones',
    required: [
      'Codigo Cotización',
      'NIT/CI',
      'Nombre_cliente',
      'Fecha_cotizacion',
      'SKU',
    ],
    optional: [
      'Producto',
      'Numero_serie',
      'Precio_unitario_Bs',
      'Estado',
      'Observaciones',
    ],
    note: 'Numero_serie es obligatorio solo para Pagada. Una fila por equipo. Repite el código, cliente, fecha, estado y observaciones para agrupar equipos. Usa NIT/CI y SKU existentes. La fecha acepta AAAA-MM-DD o DD/MM/AAAA. Precio vacío: cálculo automático; precio explícito: requiere permiso para editar precios. Pagada requiere permiso para cambiar estado. Una cotización con errores se rechaza completa.',
  },
  clients: {
    title: 'Plantilla de clientes',
    required: [
      'Nombre o razón social',
      'NIT/CI',
      'Departamento',
      'Ciudad/Zona',
      'WhatsApp',
      'Tipo de cliente',
      'Nivel de precio',
      'Rubro o actividad',
    ],
    optional: ['Observaciones'],
  },
  products: {
    title: 'Plantilla de productos',
    required: ['SKU', 'Nombre', 'Categoría', 'Precio de venta normal (nivel x1) (Bs)'],
    optional: ['Código de barras', 'Descripción', 'Activo', 'Almacén', 'Cantidad'],
    note: 'Almacén y Cantidad son opcionales, pero si completas Almacén también debes indicar una Cantidad entera mayor que 0.',
  },
  warehouses: {
    title: 'Plantilla de almacenes',
    required: ['Nombre', 'Código'],
    optional: ['Descripción', 'Dirección', 'Activo'],
  },
  stocks: {
    title: 'Plantilla de existencias',
    required: ['SKU', 'Almacén', 'Cantidad'],
    optional: ['Stock mínimo'],
    note: 'Si dejas Stock mínimo vacío, el sistema utilizará 0.',
  },
}

export function DataTransferPanel({ resource, filters = {} }: DataTransferPanelProps) {
  const user = useAuthStore((state) => state.user)
  const permissionResource = {
    quotations: 'quotations.quotation',
    clients: 'clients.client',
    products: 'products.product',
    warehouses: 'inventory.warehouse',
    stocks: 'inventory.stock',
  }[resource]
  const [appLabel, model] = permissionResource.split('.')
  const canImport = hasPermission(
    user,
    resource === 'quotations'
      ? 'quotations.import_quotation'
      : `${appLabel}.add_${model}`,
  )
  const canExport = hasPermission(
    user,
    resource === 'quotations'
      ? 'quotations.export_quotation'
      : `${appLabel}.view_${model}`,
  )
  const canCreateClientTypes = hasPermission(user, 'clients.add_clienttype')
  const canCreatePriceLevels = hasPermission(user, 'products.add_pricelevel')
  const canCreateCategories = hasPermission(user, 'products.add_category')
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<ImportMode>('partial')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [reporting, setReporting] = useState(false)
  const [confirmImport, setConfirmImport] = useState(false)
  const [showTemplateInfo, setShowTemplateInfo] = useState(false)
  const [createMissingClientTypes, setCreateMissingClientTypes] = useState(false)
  const [createMissingPriceLevels, setCreateMissingPriceLevels] = useState(false)
  const [createMissingCategories, setCreateMissingCategories] = useState(false)
  const label =
    resource === 'quotations'
      ? 'cotizaciones'
      : resource === 'clients'
        ? 'clientes'
        : resource === 'products'
          ? 'productos'
          : resource === 'warehouses'
            ? 'almacenes'
            : 'vinculaciones de inventario'
  const validateFile = (candidate: File | null) => {
    if (!candidate) return
    if (!/\.(xlsx|xls)$/i.test(candidate.name)) {
      setError('Selecciona un archivo con extensión .xls o .xlsx.')
      return
    }
    if (candidate.size > 15 * 1024 * 1024) {
      setError('El archivo no puede superar los 15 MB.')
      return
    }
    setError('')
    setResult(null)
    setFile(candidate)
  }

  const importFile = () => {
    if (!file) return
    setConfirmImport(false)
    setBusy(true)
    setError('')
    void transferService
      .importFile(resource, file, mode, {
        createMissingClientTypes,
        createMissingPriceLevels,
        createMissingCategories,
      })
      .then((response) => {
        setResult(response)
        if (response.created_client_types?.length) {
          toast.success(
            `${response.created_client_types.length} tipo(s) de cliente creados.`,
          )
        }
        if (response.created_price_levels?.length) {
          toast.success(
            `${response.created_price_levels.length} nivel(es) de precio creados.`,
          )
        }
        if (response.created_categories?.length) {
          toast.success(`${response.created_categories.length} categoría(s) creadas.`)
        }
      })
      .catch((requestError: unknown) =>
        setError(getAdminErrorMessage(requestError, 'No se pudo procesar el archivo.')),
      )
      .finally(() => setBusy(false))
  }

  const download = (kind: 'template' | 'export') => {
    setBusy(true)
    const promise =
      kind === 'template'
        ? transferService.downloadTemplate(resource)
        : transferService.exportData(resource, filters)
    void promise
      .then((blob) =>
        saveBlob(
          blob,
          `${kind === 'template' ? 'Plantilla' : 'Exportacion'}_${resource}.xlsx`,
        ),
      )
      .catch((requestError: unknown) =>
        toast.error(
          getAdminErrorMessage(requestError, 'No se pudo descargar el archivo.'),
        ),
      )
      .finally(() => setBusy(false))
  }

  const downloadReport = () => {
    if (!result?.errors.length) return
    setReporting(true)
    void transferService
      .downloadReport(resource, result.errors)
      .then((blob) => saveBlob(blob, `Observaciones_${resource}.xlsx`))
      .catch((requestError: unknown) =>
        toast.error(
          getAdminErrorMessage(requestError, 'No se pudo descargar el reporte.'),
        ),
      )
      .finally(() => setReporting(false))
  }

  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-slate-900">
            <FileSpreadsheet className="size-5 text-brand-600" /> Importar y exportar{' '}
            {label}
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            {canImport
              ? 'Descarga la plantilla, completa sus columnas y carga el archivo. La importación parcial guarda solo los registros válidos.'
              : 'Descarga la información actual en formato Excel.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(canExport || (resource === 'quotations' && canImport)) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowTemplateInfo(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="size-4" /> Descargar plantilla Excel
            </button>
          )}
        </div>
      </div>
      {canImport && (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            validateFile(event.dataTransfer.files[0] ?? null)
          }}
          onClick={() => inputRef.current?.click()}
          className={`mt-5 cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition ${dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50/40'}`}
        >
          <FileUp className="mx-auto size-8 text-brand-600" />
          <p className="mt-2 text-sm font-bold text-slate-800">
            Arrastra tu archivo aquí o selecciónalo
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Formatos permitidos: .xls y .xlsx · Máximo 15 MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx"
            className="sr-only"
            onChange={(event) => validateFile(event.target.files?.[0] ?? null)}
          />
        </div>
      )}
      {canImport && file && (
        <p className="mt-3 text-sm font-semibold text-slate-700">
          Archivo seleccionado: <span className="font-normal">{file.name}</span>
        </p>
      )}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {canImport && (
          <>
            <label className="text-sm font-semibold text-slate-700">
              Modo de importación
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as ImportMode)}
                className="mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              >
                <option value="partial">Parcial: guardar válidos</option>
                <option value="total">Total: guardar solo si todo es válido</option>
              </select>
            </label>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          {canImport && (
            <button
              type="button"
              aria-label="Procesar archivo seleccionado"
              disabled={!file || busy}
              onClick={() => setConfirmImport(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <FileUp className="size-4" />
              )}{' '}
              Procesar archivo
            </button>
          )}
          {canExport && (
            <button
              type="button"
              disabled={busy}
              onClick={() => download('export')}
              className="inline-flex items-center gap-2 rounded-xl border border-brand-200 px-4 py-2.5 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
            >
              <Download className="size-4" /> Exportar Excel
            </button>
          )}
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
        >
          {error}
        </p>
      )}
      {result && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-800">
            Proceso terminado: {result.created} creados · {result.rejected} rechazados.
          </p>
          {((result.created_client_types?.length ?? 0) > 0 ||
            (result.created_price_levels?.length ?? 0) > 0 ||
            (result.created_categories?.length ?? 0) > 0) && (
            <p className="mt-1 text-xs leading-5 text-emerald-700">
              Datos auxiliares creados: {result.created_client_types?.length ?? 0} tipo(s)
              de cliente, {result.created_price_levels?.length ?? 0} nivel(es) de precio y{' '}
              {result.created_categories?.length ?? 0} categoría(s).
            </p>
          )}
          {result.errors.length > 0 && (
            <>
              <div className="mt-3 max-h-52 overflow-auto rounded-lg border border-red-100 bg-white">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-red-50 text-red-800">
                    <tr>
                      <th className="px-3 py-2">Fila</th>
                      <th className="px-3 py-2">Columna</th>
                      <th className="px-3 py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((item, index) => (
                      <tr
                        key={`${item.fila}-${item.columna}-${index}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-3 py-2">{item.fila}</td>
                        <td className="px-3 py-2">{item.columna}</td>
                        <td className="px-3 py-2">{item.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                disabled={reporting}
                onClick={downloadReport}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Download className="size-4" /> Descargar observaciones
              </button>
            </>
          )}
        </div>
      )}
      {canImport && (
        <ConfirmDialog
          open={confirmImport && resource !== 'clients' && resource !== 'products'}
          title="¿Procesar este archivo?"
          description={
            mode === 'partial'
              ? resource === 'quotations'
                ? 'Se guardarán únicamente las cotizaciones completas y válidas. Si una fila falla, se rechaza toda su cotización.'
                : 'Se guardarán únicamente las filas válidas. Las filas con problemas aparecerán en el reporte.'
              : 'Si existe un solo error, no se guardará ninguna fila del archivo.'
          }
          confirmLabel="Procesar archivo"
          pending={busy}
          onClose={() => setConfirmImport(false)}
          onConfirm={importFile}
        />
      )}
      {canImport && resource === 'clients' && (
        <ClientImportDialog
          open={confirmImport}
          mode={mode}
          pending={busy}
          canCreateClientTypes={canCreateClientTypes}
          canCreatePriceLevels={canCreatePriceLevels}
          createClientTypes={createMissingClientTypes}
          createPriceLevels={createMissingPriceLevels}
          onCreateClientTypesChange={setCreateMissingClientTypes}
          onCreatePriceLevelsChange={setCreateMissingPriceLevels}
          onClose={() => setConfirmImport(false)}
          onConfirm={importFile}
        />
      )}
      {canImport && resource === 'products' && (
        <ProductImportDialog
          open={confirmImport}
          mode={mode}
          pending={busy}
          canCreateCategories={canCreateCategories}
          createCategories={createMissingCategories}
          onCreateCategoriesChange={setCreateMissingCategories}
          onClose={() => setConfirmImport(false)}
          onConfirm={importFile}
        />
      )}
      <TemplateDownloadDialog
        open={showTemplateInfo}
        resource={resource}
        pending={busy}
        onClose={() => setShowTemplateInfo(false)}
        onDownload={() => {
          setShowTemplateInfo(false)
          download('template')
        }}
      />
    </section>
  )
}

function TemplateDownloadDialog({
  open,
  resource,
  pending,
  onClose,
  onDownload,
}: {
  open: boolean
  resource: TransferResource
  pending: boolean
  onClose: () => void
  onDownload: () => void
}) {
  if (!open) return null
  const fields = templateFields[resource]

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-fields-title"
        className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
              <Info className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 id="template-fields-title" className="font-bold text-slate-900">
                {fields.title}
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Revisa qué información debes completar antes de descargarla.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            disabled={pending}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <FieldList
            title="Campos obligatorios"
            fields={fields.required}
            tone="required"
          />
          <FieldList title="Campos opcionales" fields={fields.optional} tone="optional" />
        </div>
        {fields.note && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            {fields.note}
          </p>
        )}
        <p className="mt-4 text-xs leading-5 text-slate-500">
          {resource === 'quotations'
            ? 'El archivo incluye una hoja de instrucciones para completar la carga.'
            : 'Esta explicación solo se muestra en el sistema y no se agregará dentro del archivo Excel.'}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onDownload}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Descargar plantilla
          </button>
        </div>
      </section>
    </div>
  )
}

function FieldList({
  title,
  fields,
  tone,
}: {
  title: string
  fields: string[]
  tone: 'required' | 'optional'
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        tone === 'required'
          ? 'border-slate-200 bg-slate-50'
          : 'border-emerald-200 bg-emerald-50/60'
      }`}
    >
      <h4
        className={`text-xs font-bold uppercase tracking-wide ${
          tone === 'required' ? 'text-slate-700' : 'text-emerald-800'
        }`}
      >
        {title}
      </h4>
      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        {fields.map((field) => (
          <li key={field} className="flex items-start gap-2">
            <span
              className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                tone === 'required' ? 'bg-slate-500' : 'bg-emerald-500'
              }`}
            />
            {field}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProductImportDialog({
  open,
  mode,
  pending,
  canCreateCategories,
  createCategories,
  onCreateCategoriesChange,
  onClose,
  onConfirm,
}: {
  open: boolean
  mode: ImportMode
  pending: boolean
  canCreateCategories: boolean
  createCategories: boolean
  onCreateCategoriesChange: (value: boolean) => void
  onClose: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-import-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h3 id="product-import-title" className="text-base font-bold text-slate-900">
          Preparar importación de productos
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Puedes crear automáticamente todas las categorías nuevas encontradas en el
          archivo, sin abandonar la importación.
        </p>
        <div className="mt-4">
          <ImportReferenceOption
            label="Crear categorías que no existan"
            description="Crea cada categoría nueva una sola vez y la asigna a sus productos."
            checked={createCategories}
            disabled={!canCreateCategories || pending}
            noPermission={!canCreateCategories}
            onChange={onCreateCategoriesChange}
          />
        </div>
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          {mode === 'partial'
            ? 'Se guardarán los productos válidos y se informarán las filas rechazadas.'
            : 'Si el archivo contiene errores, no se guardará ningún producto.'}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? 'Procesando…' : 'Procesar archivo'}
          </button>
        </div>
      </section>
    </div>
  )
}

interface ClientImportDialogProps {
  open: boolean
  mode: ImportMode
  pending: boolean
  canCreateClientTypes: boolean
  canCreatePriceLevels: boolean
  createClientTypes: boolean
  createPriceLevels: boolean
  onCreateClientTypesChange: (value: boolean) => void
  onCreatePriceLevelsChange: (value: boolean) => void
  onClose: () => void
  onConfirm: () => void
}

function ClientImportDialog({
  open,
  mode,
  pending,
  canCreateClientTypes,
  canCreatePriceLevels,
  createClientTypes,
  createPriceLevels,
  onCreateClientTypesChange,
  onCreatePriceLevelsChange,
  onClose,
  onConfirm,
}: ClientImportDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-import-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h3 id="client-import-title" className="text-base font-bold text-slate-900">
          Preparar importación de clientes
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Si el archivo contiene varios datos nuevos, puedes crearlos todos en un solo
          paso. Revisa estas opciones antes de continuar.
        </p>
        <div className="mt-4 space-y-3">
          <ImportReferenceOption
            label="Crear tipos de cliente que no existan"
            description="Crea cada tipo nuevo una sola vez y lo asigna a sus clientes."
            checked={createClientTypes}
            disabled={!canCreateClientTypes || pending}
            noPermission={!canCreateClientTypes}
            onChange={onCreateClientTypesChange}
          />
          <ImportReferenceOption
            label="Crear niveles de precio que no existan"
            description="Crea cada nivel nuevo con su precio normal x1."
            checked={createPriceLevels}
            disabled={!canCreatePriceLevels || pending}
            noPermission={!canCreatePriceLevels}
            onChange={onCreatePriceLevelsChange}
          />
        </div>
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          {mode === 'partial'
            ? 'Se guardarán los clientes válidos y se informarán las filas rechazadas.'
            : 'Si el archivo contiene errores, no se guardará ningún cliente.'}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? 'Procesando…' : 'Procesar archivo'}
          </button>
        </div>
      </section>
    </div>
  )
}

function ImportReferenceOption({
  label,
  description,
  checked,
  disabled,
  noPermission,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled: boolean
  noPermission: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label
      className={`flex gap-3 rounded-xl border p-4 ${disabled ? 'bg-slate-50' : 'cursor-pointer hover:border-brand-300'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 accent-brand-600"
      />
      <span>
        <span className="block text-sm font-bold text-slate-800">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {noPermission ? 'Tu rol no permite crear este dato.' : description}
        </span>
      </span>
    </label>
  )
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
