import { Link } from 'react-router-dom'
import { Edit, Search, UsersRound, Plus } from 'lucide-react'
import { useState } from 'react'

import { PageHeading } from '../../../components/common/PageHeading'
import { AdminTable, Pagination } from '../../admin/components/AdminTable'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { useClients } from '../hooks/useClients'
import { useAuthStore } from '../../../store/authStore'
import { hasAnyPermission, hasPermission } from '../../../utils/permissions'

export function ClientsPage() {
  const [search, setSearch] = useState('')
  const user = useAuthStore((state) => state.user)
  const [page, setPage] = useState(1)
  const params = { search, page, ordering: 'name' }
  const query = useClients(params)
  const clients = query.data?.results ?? []
  return (
    <>
      <PageHeading
        title="Clientes"
        description="Consulta tu cartera de clientes e importa nuevos registros desde una plantilla Excel validada."
        action={
          <div className="flex flex-wrap gap-2">
            {hasPermission(user, 'clients.add_client') && (
              <Link
                to="/clients/new"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700"
              >
                <Plus className="size-4" /> Nuevo cliente
              </Link>
            )}
            {hasAnyPermission(user, ['clients.view_client', 'clients.add_client']) && (
              <Link
                to={`/clients/import-export${search ? `?search=${encodeURIComponent(search)}` : ''}`}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-200 px-4 py-3 text-sm font-bold text-brand-700 hover:bg-brand-50"
              >
                <UsersRound className="size-4" /> Importar / exportar
              </Link>
            )}
          </div>
        }
      />
      <section className="mb-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
        <h3 className="text-sm font-bold text-brand-900">
          ¿Cómo funcionan los clientes?
        </h3>
        <p className="mt-1 text-sm leading-6 text-brand-900/75">
          Registra las personas y empresas a las que vendes. Puedes crear, editar,
          importar y exportar clientes desde las acciones principales.
        </p>
      </section>
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="relative block max-w-xl">
          <span className="sr-only">Buscar clientes</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Buscar por nombre, NIT/CI, ciudad o WhatsApp…"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
        </label>
      </section>
      <AdminTable
        headers={[
          'Cliente',
          'NIT/CI',
          'Ubicación',
          'WhatsApp',
          'Tipo',
          'Nivel de precio',
          'Acciones',
        ]}
        loading={query.isLoading}
        error={
          query.error
            ? getAdminErrorMessage(query.error, 'No se pudieron cargar los clientes.')
            : undefined
        }
        empty={!clients.length}
        onRetry={() => void query.refetch()}
      >
        {clients.map((client) => (
          <tr key={client.id} className="hover:bg-slate-50/70">
            <td className="px-5 py-4">
              <p className="font-semibold text-slate-800">{client.name}</p>
              <p className="text-xs text-slate-500">{client.business_activity}</p>
            </td>
            <td className="px-5 py-4 font-mono text-xs text-slate-600">
              {client.tax_id}
            </td>
            <td className="px-5 py-4 text-sm text-slate-600">
              {client.department} · {client.city_zone}
            </td>
            <td className="px-5 py-4 text-sm text-slate-600">{client.whatsapp}</td>
            <td className="px-5 py-4 text-sm text-slate-600">{client.client_type}</td>
            <td className="px-5 py-4">
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                {client.price_level.name}
              </span>
            </td>
            <td className="px-5 py-4">
              {hasPermission(user, 'clients.change_client') && (
                <Link
                  to={`/clients/${client.id}/edit`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-900"
                >
                  <Edit className="size-4" /> Editar
                </Link>
              )}
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
