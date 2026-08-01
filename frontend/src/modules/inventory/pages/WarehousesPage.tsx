import { Link } from 'react-router-dom'
import { Plus, Search, Edit } from 'lucide-react'
import { useState } from 'react'
import { PageHeading } from '../../../components/common/PageHeading'
import { AdminTable, Pagination } from '../../admin/components/AdminTable'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { useWarehouses } from '../hooks/useInventory'
import { useAuthStore } from '../../../store/authStore'
import { hasAnyPermission, hasPermission } from '../../../utils/permissions'
export function WarehousesPage() {
  const user = useAuthStore((state) => state.user)
  const canAdd = hasPermission(user, 'inventory.add_warehouse')
  const canChange = hasPermission(user, 'inventory.change_warehouse')
  const canTransfer = hasAnyPermission(user, [
    'inventory.view_warehouse',
    'inventory.add_warehouse',
  ])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useWarehouses({ search, page, ordering: 'name' })
  const rows = q.data?.results ?? []
  return (
    <>
      <PageHeading
        title="Almacenes"
        description="Administra las ubicaciones donde se almacena el inventario."
        action={
          <div className="flex items-center gap-3">
            <Link to="/inventory" className="text-sm font-bold text-brand-700">
              ← Regresar
            </Link>
            {canTransfer && <Link
              to="/inventory/warehouses/import-export"
              className="rounded-xl border border-brand-200 px-3 py-3 text-xs font-bold text-brand-700"
            >
              Importar / exportar
            </Link>}
            {canAdd && <Link
              to="/inventory/warehouses/new"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
            >
              <Plus className="size-4" /> Nuevo almacén
            </Link>}
          </div>
        }
      />
      <section className="mb-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
        <h3 className="text-sm font-bold text-brand-900">¿Qué es un almacén?</h3>
        <p className="mt-1 text-sm leading-6 text-brand-900/75">
          Es el lugar físico donde se guardan los productos. Crea uno por sucursal,
          depósito o ubicación que necesites controlar.
        </p>
      </section>
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="relative block max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Buscar por nombre, código o dirección…"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm"
          />
        </label>
      </section>
      <AdminTable
        headers={['Almacén', 'Código', 'Dirección', 'Estado', 'Acciones']}
        loading={q.isLoading}
        error={
          q.error
            ? getAdminErrorMessage(q.error, 'No se pudieron cargar los almacenes.')
            : undefined
        }
        empty={!rows.length}
        onRetry={() => void q.refetch()}
      >
        {rows.map((w) => (
          <tr key={w.id}>
            <td className="px-5 py-4 font-semibold">{w.name}</td>
            <td className="px-5 py-4 font-mono text-xs">{w.code}</td>
            <td className="px-5 py-4 text-slate-600">{w.address || '—'}</td>
            <td className="px-5 py-4">{w.is_active ? 'Activo' : 'Inactivo'}</td>
            <td className="px-5 py-4">
              {canChange && <Link
                to={`/inventory/warehouses/${w.id}/edit`}
                className="inline-flex items-center gap-1 text-xs font-bold text-brand-700"
              >
                <Edit className="size-4" /> Editar
              </Link>}
            </td>
          </tr>
        ))}
      </AdminTable>
      {q.data && <Pagination page={page} count={q.data.count} onPageChange={setPage} />}
    </>
  )
}
