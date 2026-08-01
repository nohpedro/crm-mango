import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, FileUp, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '../../../components/common/ConfirmDialog'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { transferService } from '../services/transfer.service'
import type {
  ImportErrorRow,
  ImportMode,
  TransferResource,
} from '../types/transfer.types'
import { useAuthStore } from '../../../store/authStore'
import { hasPermission } from '../../../utils/permissions'

interface DataTransferPanelProps {
  resource: TransferResource
  filters?: Record<string, string | number | boolean | undefined>
}

export function DataTransferPanel({ resource, filters = {} }: DataTransferPanelProps) {
  const user = useAuthStore((state) => state.user)
  const permissionResource = {
    clients: 'clients.client',
    products: 'products.product',
    warehouses: 'inventory.warehouse',
    stocks: 'inventory.stock',
  }[resource]
  const [appLabel, model] = permissionResource.split('.')
  const canImport = hasPermission(user, `${appLabel}.add_${model}`)
  const canExport = hasPermission(user, `${appLabel}.view_${model}`)
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<ImportMode>('partial')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{
    created: number
    rejected: number
    errors: ImportErrorRow[]
  } | null>(null)
  const [error, setError] = useState('')
  const [reporting, setReporting] = useState(false)
  const [confirmImport, setConfirmImport] = useState(false)
  const label =
    resource === 'clients'
      ? 'clientes'
      : resource === 'products'
        ? 'productos'
        : resource === 'warehouses'
          ? 'almacenes'
          : 'vinculaciones de inventario'
  const [missingReference, setMissingReference] = useState<
    'category' | 'price-level' | null
  >(null)

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
      .importFile(resource, file, mode)
      .then((response) => {
        setResult(response)
        const hasCategory = response.errors.some(
          (item) => item.columna === 'CategorÃ­a' && item.motivo.includes('No existe'),
        )
        const hasPrice = response.errors.some(
          (item) =>
            item.columna === 'Nivel de precio' && item.motivo.includes('No existe'),
        )
        if (hasCategory) setMissingReference('category')
        else if (hasPrice) setMissingReference('price-level')
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
          {canExport && <button
            type="button"
            disabled={busy}
            onClick={() => download('template')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="size-4" /> Descargar plantilla Excel
          </button>}
        </div>
      </div>
      {canImport && <div
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
      </div>}
      {canImport && file && (
        <p className="mt-3 text-sm font-semibold text-slate-700">
          Archivo seleccionado: <span className="font-normal">{file.name}</span>
        </p>
      )}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {canImport && <>
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
        </>}
        <div className="flex flex-wrap gap-2">
          {canImport && <button
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
          </button>}
          {canExport && <button
            type="button"
            disabled={busy}
            onClick={() => download('export')}
            className="inline-flex items-center gap-2 rounded-xl border border-brand-200 px-4 py-2.5 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
          >
            <Download className="size-4" /> Exportar Excel
          </button>}
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
      {canImport && <ConfirmDialog
        open={confirmImport}
        title="¿Procesar este archivo?"
        description={
          mode === 'partial'
            ? 'Se guardarán únicamente las filas válidas. Las filas con problemas aparecerán en el reporte.'
            : 'Si existe un solo error, no se guardará ninguna fila del archivo.'
        }
        confirmLabel="Procesar archivo"
        pending={busy}
        onClose={() => setConfirmImport(false)}
        onConfirm={importFile}
      />}
      <ConfirmDialog
        open={Boolean(missingReference) && (missingReference === 'category'
          ? hasPermission(user, 'products.add_category')
          : hasPermission(user, 'products.add_pricelevel'))}
        title={
          missingReference === 'category'
            ? 'Categoría no encontrada'
            : 'Nivel de precio no encontrado'
        }
        description="Puedes crear este dato ahora y volver a procesar el archivo, sin salir de este flujo. ¿Deseas crearlo?"
        confirmLabel="Crear ahora"
        onClose={() => setMissingReference(null)}
        onConfirm={() => {
          const path =
            missingReference === 'category' ? '/categories/new' : '/price-levels/new'
          setMissingReference(null)
          window.location.assign(path)
        }}
      />
    </section>
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
