import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  SearchX,
} from 'lucide-react'
import type { ReactNode } from 'react'

interface AdminTableProps {
  headers: string[]
  loading?: boolean
  error?: string
  empty?: boolean
  onRetry?: () => void
  children: ReactNode
}

export function AdminTable({
  headers,
  loading,
  error,
  empty,
  onRetry,
  children,
}: AdminTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table
          aria-busy={Boolean(loading)}
          className="data-table min-w-full text-left text-sm"
        >
          <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="whitespace-nowrap px-5 py-4 font-bold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={headers.length} className="px-5 py-14 text-center">
                  <LoaderCircle className="mx-auto size-6 animate-spin text-brand-600" />
                  <span role="status" className="mt-2 block text-sm text-slate-500">
                    Cargando información…
                  </span>
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={headers.length} className="px-5 py-14 text-center">
                  <AlertCircle className="mx-auto size-6 text-red-500" />
                  <p role="alert" className="mt-2 text-sm text-red-700">
                    {error}
                  </p>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                    >
                      Reintentar
                    </button>
                  )}
                </td>
              </tr>
            )}
            {!loading && !error && empty && (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-5 py-14 text-center text-sm text-slate-500"
                >
                  <SearchX
                    aria-hidden="true"
                    className="mx-auto mb-3 size-8 text-slate-400"
                  />
                  <p className="font-semibold text-slate-700">
                    No hay registros para los filtros seleccionados.
                  </p>
                  <p className="mt-2 text-xs leading-5">
                    Prueba otra búsqueda o revisa los filtros aplicados.
                  </p>
                </td>
              </tr>
            )}
            {!loading && !error && !empty && children}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface PaginationProps {
  page: number
  count: number
  pageSize?: number
  onPageChange: (page: number) => void
}

export function Pagination({
  page,
  count,
  pageSize = 20,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-3 px-1 py-4 text-xs text-slate-500"
    >
      <span role="status">
        {count === 0
          ? 'Sin resultados'
          : `${Math.min((page - 1) * pageSize + 1, count)}–${Math.min(page * pageSize, count)} de ${count}`}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Anterior</span>
        </button>
        <span className="min-w-20 text-center font-semibold text-slate-700">
          Página {page} / {totalPages}
        </span>
        <button
          type="button"
          aria-label="Página siguiente"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  )
}
