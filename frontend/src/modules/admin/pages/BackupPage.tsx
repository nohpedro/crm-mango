import { useState } from 'react'
import { DatabaseBackup, Download, Upload, ShieldAlert, LoaderCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeading } from '../../../components/common/PageHeading'
import { backupService, type BackupSummary } from '../services/backup.service'
import { tokenStorage } from '../../auth/services/tokenStorage'
import { useAuthStore } from '../../../store/authStore'
import { getAdminErrorMessage } from '../components/AdminError'

export function BackupPage() {
  const [file, setFile] = useState<File | null>(null)
  const [summary, setSummary] = useState<BackupSummary | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState<'export' | 'validate' | 'restore' | null>(null)
  const [error, setError] = useState('')
  const cache = useQueryClient()
  const navigate = useNavigate()
  const download = async () => {
    setBusy('export')
    setError('')
    try {
      const blob = await backupService.download()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `IDESEM-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      toast.success('Backup generado. Guarda el archivo en un lugar seguro.')
    } catch (cause) {
      setError(getAdminErrorMessage(cause, 'No se pudo descargar el backup.'))
    } finally {
      setBusy(null)
    }
  }
  const upload = async (action: 'validate' | 'restore') => {
    if (
      !file ||
      busy ||
      (action === 'restore' && (!summary || confirmation !== 'RESTAURAR'))
    )
      return
    setBusy(action)
    setError('')
    try {
      const result = await backupService.upload(file, action, confirmation)
      if (action === 'validate') setSummary(result)
      else {
        tokenStorage.clear()
        useAuthStore.getState().clearSession()
        cache.clear()
        toast.success(
          'Backup restaurado. Inicia sesión con un usuario y contraseña del respaldo.',
        )
        navigate('/login', { replace: true })
      }
    } catch (cause) {
      setError(
        getAdminErrorMessage(
          cause,
          action === 'restore'
            ? 'No se pudo confirmar la restauración. Consulta el estado del sistema antes de reintentar.'
            : 'El archivo no es válido o no se pudo revisar.',
        ),
      )
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      <PageHeading
        title="Configuración · Backup"
        description="Exporta el estado actual del sistema o restaura un respaldo completo con su fecha de corte."
      />
      <section className="mb-5 rounded-2xl border border-brand-100 bg-brand-50 p-5 text-sm leading-6 text-brand-900">
        <h3 className="flex items-center gap-2 font-bold">
          <DatabaseBackup className="size-5" /> Respaldo completo del sistema
        </h3>
        <p className="mt-2">
          Incluye clientes, productos, precios, inventario, cotizaciones, plantillas,
          imágenes, usuarios, contraseñas protegidas y permisos. Contiene todos los
          registros disponibles al momento de exportar, con su fecha y hora.
        </p>
        <p className="mt-2">
          No incluye sesiones ni configuración del servidor. Solo los administradores
          pueden exportar o restaurar. El archivo contiene información privada: consérvalo
          en un lugar seguro.
        </p>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold">1. Exportar backup</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Descarga una copia con los datos actuales. Puedes conservar varias copias para
            volver a una fecha anterior.
          </p>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void download()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            <Download className="size-4" /> Generar y descargar backup
          </button>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold">2. Importar backup</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Selecciona un backup IDESEM compatible. Primero revisaremos el contenido sin
            modificar los datos.
          </p>
          <label className="mt-4 block text-sm font-semibold">
            Archivo de respaldo (.zip, máximo 100 MB)
            <input
              type="file"
              accept=".zip"
              disabled={Boolean(busy)}
              className="mt-2 block w-full rounded-xl border border-slate-300 p-3 text-sm"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null
                setSummary(null)
                setConfirmation('')
                setFile(null)
                setError('')
                if (
                  selected &&
                  (!selected.name.toLowerCase().endsWith('.zip') ||
                    selected.size > 100 * 1024 * 1024)
                ) {
                  setError('Selecciona un archivo .zip de hasta 100 MB.')
                  return
                }
                setFile(selected)
              }}
            />
          </label>
          <button
            type="button"
            disabled={!file || Boolean(busy)}
            onClick={() => void upload('validate')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-brand-200 px-4 py-3 font-bold text-brand-700 disabled:opacity-50"
          >
            <Upload className="size-4" /> Revisar backup
          </button>
        </section>
      </div>
      {busy && (
        <p
          role="status"
          className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand-700"
        >
          <LoaderCircle className="size-4 animate-spin" />
          {busy === 'restore'
            ? 'Restaurando. No cierres esta pantalla…'
            : busy === 'validate'
              ? 'Revisando el archivo…'
              : 'Generando el backup…'}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {summary && (
        <section className="mt-5 rounded-2xl border border-amber-200 bg-white p-6">
          <h3 className="font-bold">Backup listo para restaurar</h3>
          <p className="mt-2 text-sm">
            Fecha del respaldo:{' '}
            <strong>{new Date(summary.created_at).toLocaleString('es-BO')}</strong>
          </p>
          <dl className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries({ ...summary.counts, Imágenes: summary.images }).map(
              ([label, count]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="font-bold">{count}</dd>
                </div>
              ),
            )}
          </dl>
          <div className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <p className="flex items-center gap-2 font-bold">
              <ShieldAlert className="size-5" /> Se reemplazarán todos los datos actuales
            </p>
            <p>
              Los cambios posteriores a la fecha del backup dejarán de aparecer, incluidos
              usuarios y permisos. Se guardará una copia de seguridad del estado anterior
              en el servidor. Realiza esta operación cuando nadie más esté trabajando en
              el sistema.
            </p>
          </div>
          <label className="mt-4 block text-sm font-semibold">
            Escribe RESTAURAR para confirmar
            <input
              value={confirmation}
              disabled={Boolean(busy)}
              autoComplete="off"
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-2 block w-full max-w-sm rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="button"
            disabled={confirmation !== 'RESTAURAR' || Boolean(busy)}
            onClick={() => void upload('restore')}
            className="mt-4 rounded-xl bg-red-600 px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            Restaurar y reemplazar datos
          </button>
        </section>
      )}
    </>
  )
}
