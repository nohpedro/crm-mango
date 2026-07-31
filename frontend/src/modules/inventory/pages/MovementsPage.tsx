import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { PageHeading } from '../../../components/common/PageHeading'
import { AdminTable, Pagination } from '../../admin/components/AdminTable'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { useMovements } from '../hooks/useInventory'
export function MovementsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useMovements({ search, page })
  const rows = q.data?.results ?? []
  return (
    <>
      <PageHeading
        title="Movimientos"
        description="Consulta entradas, salidas y ajustes registrados sobre el inventario."
        action={
          <div className="flex items-center gap-3">
            <Link to="/inventory" className="text-sm font-bold text-brand-700">
              ← Regresar
            </Link>
            <Link
              to="/inventory/movements/new"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
            >
              <Plus className="size-4" /> Registrar movimiento
            </Link>
          </div>
        }
      />
      <section className="mb-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
        <h3 className="text-sm font-bold text-brand-900">
          Registra cada cambio de stock
        </h3>
        <p className="mt-1 text-sm leading-6 text-brand-900/75">
          Usa Entrada cuando recibes mercadería, Salida cuando entregas productos y Ajuste
          para corregir una diferencia.
        </p>
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
            placeholder="Buscar por producto, almacén o referencia…"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm"
          />
        </label>
      </section>
      <AdminTable
        headers={[
          'Fecha',
          'Producto',
          'Almacén',
          'Tipo',
          'Variación',
          'Resultado',
          'Referencia',
        ]}
        loading={q.isLoading}
        error={
          q.error
            ? getAdminErrorMessage(q.error, 'No se pudieron cargar los movimientos.')
            : undefined
        }
        empty={!rows.length}
        onRetry={() => void q.refetch()}
      >
        {rows.map((m) => (
          <tr key={m.id}>
            <td className="px-5 py-4 text-xs">
              {new Date(m.created_at).toLocaleString('es-BO')}
            </td>
            <td className="px-5 py-4">
              {m.stock.product_name}
              <div className="font-mono text-xs text-slate-500">
                {m.stock.product_sku}
              </div>
            </td>
            <td className="px-5 py-4">{m.stock.warehouse_name}</td>
            <td className="px-5 py-4">{m.movement_type_display}</td>
            <td
              className={`px-5 py-4 font-bold ${m.quantity_delta < 0 ? 'text-red-600' : 'text-emerald-600'}`}
            >
              {m.quantity_delta > 0 ? '+' : ''}
              {m.quantity_delta}
            </td>
            <td className="px-5 py-4 font-bold">{m.resulting_quantity}</td>
            <td className="px-5 py-4 text-slate-600">{m.reference || '—'}</td>
          </tr>
        ))}
      </AdminTable>
      {q.data && <Pagination page={page} count={q.data.count} onPageChange={setPage} />}
    </>
  )
}
