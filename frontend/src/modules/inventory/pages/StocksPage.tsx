import { Link } from 'react-router-dom'
import { ArrowDownToLine, Edit, Link2, Search } from 'lucide-react'
import { useState } from 'react'
import { PageHeading } from '../../../components/common/PageHeading'
import { AdminTable, Pagination } from '../../admin/components/AdminTable'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { useStocks } from '../hooks/useInventory'
import { useAuthStore } from '../../../store/authStore'
import { hasPermission } from '../../../utils/permissions'
export function StocksPage() {
  const [search, setSearch] = useState('')
  const user = useAuthStore((state) => state.user)
  const [page, setPage] = useState(1)
  const q = useStocks({ search, page })
  const rows = q.data?.results ?? []
  return (
    <>
      <PageHeading
        title="Existencias"
        description="Consulta el stock físico, reservado, disponible y mínimo por almacén."
        action={
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {hasPermission(user, 'inventory.add_stock') && (
              <>
                <Link
                  to="/inventory/stocks/import-export"
                  className="inline-flex h-12 items-center rounded-xl px-3 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-50"
                >
                  Importar / exportar
                </Link>
                <Link
                  to="/inventory/stocks/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
                >
                  <Link2 className="size-4" /> Vincular producto
                </Link>
              </>
            )}
          </div>
        }
      />
      {/*
        <Link to="/dashboard" className="text-sm font-bold text-brand-700">
          ← Regresar al panel
        </Link>
      */}
      <section className="mb-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
        <h3 className="text-sm font-bold text-brand-900">
          ¿Cómo funciona el inventario?
        </h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-900/75">
          Una existencia conecta un producto con un almacén. El stock físico cambia
          únicamente al registrar una entrada, salida o ajuste.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          {hasPermission(user, 'inventory.view_warehouse') && (
            <Link
              to="/inventory/warehouses"
              className="rounded-lg bg-white px-3 py-2 text-brand-700"
            >
              Administrar almacenes
            </Link>
          )}
          {hasPermission(user, 'inventory.view_stockmovement') && (
            <Link
              to="/inventory/movements"
              className="rounded-lg bg-white px-3 py-2 text-brand-700"
            >
              Ver movimientos
            </Link>
          )}
        </div>
      </section>
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="relative block max-w-xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Buscar por producto, SKU o almacén…"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm"
          />
        </label>
      </section>
      <AdminTable
        headers={[
          'Producto',
          'Almacén',
          'Físico',
          'Reservado',
          'Disponible',
          'Mínimo',
          'Acciones',
        ]}
        loading={q.isLoading}
        error={
          q.error
            ? getAdminErrorMessage(q.error, 'No se pudieron cargar las existencias.')
            : undefined
        }
        empty={!rows.length}
        onRetry={() => void q.refetch()}
      >
        {rows.map((s) => (
          <tr key={s.id}>
            <td className="px-5 py-4">
              <b>{s.product.name}</b>
              <div className="font-mono text-xs text-slate-500">{s.product.sku}</div>
            </td>
            <td className="px-5 py-4">{s.warehouse.name}</td>
            <td className="px-5 py-4">{s.quantity}</td>
            <td className="px-5 py-4">{s.reserved_quantity}</td>
            <td className="px-5 py-4 font-bold">{s.available_quantity}</td>
            <td className="px-5 py-4">{s.minimum_stock}</td>
            <td className="px-5 py-4">
              <div className="flex flex-wrap gap-3">
                {hasPermission(user, 'inventory.add_stockmovement') && (
                  <Link
                    to={`/inventory/movements/new?stock=${s.id}&type=ENTRY`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"
                  >
                    <ArrowDownToLine className="size-4" /> Agregar stock
                  </Link>
                )}
                {hasPermission(user, 'inventory.change_stock') && (
                  <Link
                    to={`/inventory/stocks/${s.id}/edit`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand-700"
                  >
                    <Edit className="size-4" /> Editar mínimo
                  </Link>
                )}
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
      {q.data && <Pagination page={page} count={q.data.count} onPageChange={setPage} />}
    </>
  )
}
