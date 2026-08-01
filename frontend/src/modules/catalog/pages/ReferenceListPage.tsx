import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '../../../components/common/ConfirmDialog'
import { PageHeading } from '../../../components/common/PageHeading'
import { AdminTable, Pagination } from '../../admin/components/AdminTable'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { useAuthStore } from '../../../store/authStore'
import { hasPermission } from '../../../utils/permissions'
import { useCatalogFilters } from '../hooks/useCatalogFilters'
import {
  useCategoryMutations,
  useCategories,
  usePriceLevelMutations,
  usePriceLevels,
} from '../hooks/useCatalogQueries'

interface ReferenceListPageProps {
  kind: 'category' | 'price-level'
}

export function ReferenceListPage({ kind }: ReferenceListPageProps) {
  const { filters, update } = useCatalogFilters()
  const isCategory = kind === 'category'
  const user = useAuthStore((state) => state.user)
  const canAdd = hasPermission(user, `products.add_${isCategory ? 'category' : 'pricelevel'}`)
  const canChange = hasPermission(user, `products.change_${isCategory ? 'category' : 'pricelevel'}`)
  const canViewTiers = hasPermission(user, 'products.view_pricetier')
  const categoryQuery = useCategories(filters)
  const levelQuery = usePriceLevels(filters)
  const query = isCategory ? categoryQuery : levelQuery
  const categoryMutation = useCategoryMutations()
  const levelMutation = usePriceLevelMutations()
  const mutation = isCategory ? categoryMutation.update : levelMutation.update
  const [pendingRow, setPendingRow] = useState<{
    id: string
    activate: boolean
    name: string
  } | null>(null)
  const rows = query.data?.results ?? []
  const singular = isCategory ? 'categoría' : 'nivel de precio'
  const plural = isCategory ? 'Categorías' : 'Niveles de precio'
  const editBase = isCategory ? '/categories' : '/price-levels'
  const confirmRow = () => {
    if (!pendingRow) return
    void mutation
      .mutateAsync({ id: pendingRow.id, payload: { is_active: pendingRow.activate } })
      .then(() =>
        toast.success(
          pendingRow.activate ? 'Registro activado.' : 'Registro desactivado.',
        ),
      )
      .catch((error: unknown) =>
        toast.error(getAdminErrorMessage(error, 'No se pudo actualizar el registro.')),
      )
      .finally(() => setPendingRow(null))
  }

  return (
    <>
      <PageHeading
        title={plural}
        description={
          isCategory
            ? 'Organiza los productos por categorías comerciales.'
            : 'Configura los niveles utilizados para calcular precios.'
        }
        action={
          canAdd ? <Link
            to={`${editBase}/new`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700"
          >
            <Plus className="size-4" /> Nuevo {singular}
          </Link> : null
        }
      />
      {!isCategory && (
        <section className="mb-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
          <h3 className="text-sm font-bold text-brand-900">
            ¿Para qué sirven los niveles de precio?
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-900/75">
            Son tarifas que puedes asignar a un mismo producto según el tipo de cliente o
            la cantidad comprada. Por ejemplo: Minorista, Mayorista o Distribuidor.
            Después podrás registrar el importe de cada producto para cada nivel.
          </p>
        </section>
      )}
      <section className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar {plural.toLowerCase()}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.search}
            onChange={(event) => update({ search: event.target.value, page: 1 })}
            placeholder="Buscar por nombre, código o descripción…"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
        </label>
        <select
          aria-label="Filtrar por estado"
          value={filters.is_active}
          onChange={(event) => update({ is_active: event.target.value, page: 1 })}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-brand-500"
        >
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </section>
      <AdminTable
        headers={['Nombre', 'Código', 'Descripción', 'Estado', 'Actualizado', 'Acciones']}
        loading={query.isLoading}
        error={
          query.error
            ? getAdminErrorMessage(
                query.error,
                `No se pudieron cargar ${plural.toLowerCase()}.`,
              )
            : undefined
        }
        empty={!rows.length}
        onRetry={() => void query.refetch()}
      >
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-slate-50/70">
            <td className="px-5 py-4 font-semibold text-slate-800">{row.name}</td>
            <td className="whitespace-nowrap px-5 py-4">
              <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">
                {row.code}
              </span>
            </td>
            <td className="max-w-sm truncate px-5 py-4 text-slate-500">
              {row.description || 'Sin descripción'}
            </td>
            <td className="whitespace-nowrap px-5 py-4">
              <span
                className={
                  row.is_active
                    ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700'
                    : 'rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700'
                }
              >
                {row.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </td>
            <td className="whitespace-nowrap px-5 py-4 text-slate-500">
              {new Date(row.updated_at).toLocaleDateString('es-BO')}
            </td>
            <td className="whitespace-nowrap px-5 py-4">
              <div className="flex items-center gap-3">
                {canChange && <Link
                  to={`${editBase}/${row.id}/edit`}
                  className="text-xs font-bold text-brand-600 hover:text-brand-800"
                >
                  Editar
                </Link>}
                {!isCategory && canViewTiers && <Link to={`/price-levels/${row.id}/rules`} className="text-xs font-bold text-brand-600 hover:text-brand-800">Niveles</Link>}
                {canChange && <button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() =>
                    setPendingRow({
                      id: row.id,
                      activate: !row.is_active,
                      name: row.name,
                    })
                  }
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 disabled:opacity-50"
                >
                  {row.is_active ? 'Desactivar' : 'Activar'}
                </button>}
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
      {query.data && (
        <Pagination
          page={filters.page}
          count={query.data.count}
          onPageChange={(page) => update({ page })}
        />
      )}
      <ConfirmDialog
        open={Boolean(pendingRow)}
        title={
          pendingRow?.activate ? '¿Activar este registro?' : '¿Desactivar este registro?'
        }
        description={`El cambio actualizará el estado de ${pendingRow?.name ?? 'este registro'}.`}
        confirmLabel={pendingRow?.activate ? 'Activar' : 'Desactivar'}
        danger={pendingRow ? !pendingRow.activate : false}
        pending={mutation.isPending}
        onClose={() => setPendingRow(null)}
        onConfirm={confirmRow}
      />
    </>
  )
}
