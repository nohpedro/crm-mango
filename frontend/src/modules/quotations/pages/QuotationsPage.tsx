import { FilePlus2, FileText, Pencil, Search, UserRoundSearch, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeading } from '../../../components/common/PageHeading'
import { AdminTable, Pagination } from '../../admin/components/AdminTable'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { useAuthStore } from '../../../store/authStore'
import { hasAnyPermission, hasPermission } from '../../../utils/permissions'
import { useQuotationMutations, useQuotations } from '../hooks/useQuotations'
import type { Quotation, QuotationStatus } from '../types/quotation.types'
import { QuotationPaymentDialog } from '../components/QuotationPaymentDialog'
import { useClients } from '../../clients/hooks/useClients'
import { QuotationTransferLink } from '../components/QuotationTransferLink'

const statusLabel: Record<QuotationStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagada',
}

export function QuotationsPage() {
  const user = useAuthStore((state) => state.user)
  const [paymentQuotation, setPaymentQuotation] = useState<Quotation | null>(null)
  const canChangeStatus = hasAnyPermission(user, [
    'quotations.change_quotation_status',
    'quotations.change_quotation',
  ])
  const canCreate = hasPermission(user, 'quotations.add_quotation')
  const canEdit = hasPermission(user, 'quotations.change_quotation')
  const canViewClients = hasPermission(user, 'clients.view_client')
  const mutations = useQuotationMutations()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const status = searchParams.get('status') ?? ''
  const selectedClient = searchParams.get('client') ?? ''
  const selectedClientName = searchParams.get('client_name') ?? ''
  const [page, setPage] = useState(1)
  const clients = useClients(
    { search: clientSearch, page: 1, ordering: 'name', is_active: true },
    canViewClients && clientSearch.trim().length >= 2,
  )
  const query = useQuotations({
    search,
    status,
    client: selectedClient || undefined,
    page,
    ordering: '-quotation_date',
  })
  const quotations = query.data?.results ?? []
  const updateUrlFilters = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
    setSearchParams(next)
    setPage(1)
  }
  const changeStatus = (id: string, nextStatus: QuotationStatus) => {
    if (nextStatus === 'paid') {
      setPaymentQuotation(
        quotations.find((quotation) => String(quotation.id) === id) ?? null,
      )
      return
    }
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
          <div className="flex flex-wrap gap-2">
            <QuotationTransferLink
              filters={new URLSearchParams({
                search,
                status,
                ...(selectedClient ? { client: selectedClient } : {}),
              }).toString()}
            />
            {canCreate ? (
              <Link
                to="/quotations"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700"
              >
                <FilePlus2 className="size-4" /> Nueva cotización
              </Link>
            ) : null}
          </div>
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
      <section
        className={`mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${
          canViewClients ? 'lg:grid-cols-[1fr_1fr_auto]' : 'lg:grid-cols-[1fr_auto]'
        }`}
      >
        <label className="relative block max-w-xl flex-1">
          <span className="sr-only">Buscar cotizaciones</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Buscar por número, producto o SKU…"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
        </label>
        {canViewClients && (
          <div className="relative">
            {selectedClient ? (
              <div className="flex h-full min-h-11 items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase text-brand-600">
                    Cliente
                  </p>
                  <p className="truncate text-sm font-bold text-brand-900">
                    {selectedClientName || 'Cliente seleccionado'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Quitar filtro de cliente"
                  onClick={() => updateUrlFilters({ client: null, client_name: null })}
                  className="rounded-lg p-1.5 text-brand-700 hover:bg-white"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <>
                <label className="relative block">
                  <span className="sr-only">Filtrar por cliente</span>
                  <UserRoundSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={clientSearch}
                    onChange={(event) => setClientSearch(event.target.value)}
                    placeholder="Filtrar por cliente…"
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                  />
                </label>
                {clientSearch.trim().length >= 2 && (
                  <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                    {clients.isLoading ? (
                      <p className="px-3 py-3 text-sm text-slate-500">
                        Buscando clientes…
                      </p>
                    ) : clients.data?.results.length ? (
                      clients.data.results.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            updateUrlFilters({
                              client: client.id,
                              client_name: client.name,
                            })
                            setClientSearch('')
                          }}
                          className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-brand-50"
                        >
                          <span className="block text-sm font-bold text-slate-800">
                            {client.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            NIT/CI {client.tax_id} · {client.whatsapp}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-3 text-sm text-slate-500">
                        No se encontraron clientes.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <select
          value={status}
          onChange={(event) => {
            updateUrlFilters({ status: event.target.value || null })
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
              <div className="flex items-center gap-3">
                <Link
                  to={`/quotations/${quotation.id}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-900"
                >
                  <FileText className="size-4" /> Ver
                </Link>
                {canEdit && (
                  <Link
                    to={`/quotations/${quotation.id}/edit`}
                    aria-label={`Editar ${quotation.number}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-900"
                  >
                    <Pencil className="size-4" /> Editar
                  </Link>
                )}
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
      {query.data && (
        <Pagination page={page} count={query.data.count} onPageChange={setPage} />
      )}
      {paymentQuotation && (
        <QuotationPaymentDialog
          key={paymentQuotation.id}
          quotation={paymentQuotation}
          onClose={() => setPaymentQuotation(null)}
        />
      )}
    </>
  )
}

function formatQuotationDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-BO')
}
