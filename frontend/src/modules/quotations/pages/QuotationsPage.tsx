import { FilePlus2, FileText, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeading } from '../../../components/common/PageHeading'
import { AdminTable, Pagination } from '../../admin/components/AdminTable'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { useAuthStore } from '../../../store/authStore'
import { hasAnyPermission, hasPermission } from '../../../utils/permissions'
import { useQuotationMutations, useQuotations } from '../hooks/useQuotations'
import type { QuotationStatus } from '../types/quotation.types'

const statusLabel: Record<QuotationStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagada',
}

export function QuotationsPage() {
  const user = useAuthStore((state) => state.user)
  const canChangeStatus = hasAnyPermission(user, [
    'quotations.change_quotation_status',
    'quotations.change_quotation',
  ])
  const canCreate = hasPermission(user, 'quotations.add_quotation')
  const mutations = useQuotationMutations()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const status = searchParams.get('status') ?? ''
  const [page, setPage] = useState(1)
  const query = useQuotations({ search, status, page, ordering: '-quotation_date' })
  const quotations = query.data?.results ?? []
  const changeStatus = (id: string, nextStatus: QuotationStatus) => {
    void mutations.updateStatus
      .mutateAsync({ id, status: nextStatus })
      .then((updatedQuotation) =>
        toast.success(
          `Cotización marcada como ${statusLabel[updatedQuotation.status].toLowerCase()}.`,
        ),
      )
      .catch((error: unknown) =>
        toast.error(getAdminErrorMessage(error, 'No se pudo cambiar el estado.')),
      )
  }
  return (
    <>
      <PageHeading
        title="Historial de cotizaciones"
        description="Consulta las cotizaciones generadas, sus productos, importes, estado y documentos emitidos."
        action={
          canCreate ? (
            <Link
              to="/quotations"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700"
            >
              <FilePlus2 className="size-4" /> Nueva cotización
            </Link>
          ) : null
        }
      />
      <section className="mb-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
        <h3 className="text-sm font-bold text-brand-900">
          ¿Cómo funciona una cotización?
        </h3>
        <p className="mt-1 text-sm leading-6 text-brand-900/75">
          Selecciona el cliente, agrega los productos y define el precio. Al guardar,
          podrás descargarla en hoja estándar o en papel rollo.
        </p>
      </section>
      <section className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <label className="relative block max-w-xl flex-1">
          <span className="sr-only">Buscar cotizaciones</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Buscar por número, cliente o producto…"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
        </label>
        <select
          value={status}
          onChange={(event) => {
            const nextStatus = event.target.value
            setSearchParams(nextStatus ? { status: nextStatus } : {})
            setPage(1)
          }}
          className="rounded-xl border border-slate-200 px-3 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="paid">Pagadas</option>
        </select>
      </section>
      <AdminTable
        headers={['Número', 'Cliente', 'Total', 'Estado', 'Fecha', 'Acciones']}
        loading={query.isLoading}
        error={
          query.error
            ? getAdminErrorMessage(query.error, 'No se pudieron cargar las cotizaciones.')
            : undefined
        }
        empty={!quotations.length}
        onRetry={() => void query.refetch()}
      >
        {quotations.map((quotation) => (
          <tr key={quotation.id} className="hover:bg-slate-50/70">
            <td className="px-5 py-4 font-mono text-xs font-bold text-brand-700">
              {quotation.number}
            </td>
            <td className="px-5 py-4">
              <p className="font-semibold text-slate-800">{quotation.client_name}</p>
              <p className="text-xs text-slate-500">
                {quotation.items.length} producto(s)
              </p>
            </td>
            <td className="px-5 py-4 font-semibold text-slate-800">
              Bs {Number(quotation.total).toFixed(2)}
            </td>
            <td className="px-5 py-4">
              {canChangeStatus ? (
                <select
                  aria-label={`Cambiar estado de ${quotation.number}`}
                  value={quotation.status}
                  disabled={
                    mutations.updateStatus.isPending &&
                    mutations.updateStatus.variables?.id === String(quotation.id)
                  }
                  onChange={(event) =>
                    changeStatus(
                      String(quotation.id),
                      event.target.value as QuotationStatus,
                    )
                  }
                  className={`rounded-full border-0 px-3 py-1.5 text-xs font-bold outline-none ring-1 disabled:opacity-60 ${
                    quotation.status === 'paid'
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      : 'bg-amber-50 text-amber-800 ring-amber-200'
                  }`}
                >
                  <option value="pending">Pendiente</option>
                  <option value="paid">Pagada</option>
                </select>
              ) : (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    quotation.status === 'paid'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {statusLabel[quotation.status]}
                </span>
              )}
            </td>
            <td className="px-5 py-4 text-sm text-slate-600">
              {formatQuotationDate(quotation.quotation_date)}
            </td>
            <td className="px-5 py-4">
              <Link
                to={`/quotations/${quotation.id}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-900"
              >
                <FileText className="size-4" /> Ver
              </Link>
            </td>
          </tr>
        ))}
      </AdminTable>
      {query.data && (
        <Pagination page={page} count={query.data.count} onPageChange={setPage} />
      )}
    </>
  )
}

function formatQuotationDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-BO')
}
