import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Eye, PackagePlus, Search } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '../../../components/common/ConfirmDialog'
import { PageHeading } from '../../../components/common/PageHeading'
import { AdminTable, Pagination } from '../../admin/components/AdminTable'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { useCatalogFilters } from '../hooks/useCatalogFilters'
import {
  useCategories,
  useProductMutations,
  useProducts,
} from '../hooks/useCatalogQueries'

export function ProductsPage() {
  const { filters, update } = useCatalogFilters()
  const query = useProducts(filters)
  const categoryQuery = useCategories({
    ...filters,
    search: '',
    page: 1,
    is_active: 'true',
  })
  const mutations = useProductMutations()
  const [pendingAction, setPendingAction] = useState<{
    kind: 'activate' | 'deactivate' | 'delete' | 'restore'
    id: string
    label: string
    title: string
    description: string
  } | null>(null)
  const products = query.data?.results ?? []
  const action = (
    kind: 'activate' | 'deactivate' | 'delete' | 'restore',
    id: string,
    label: string,
  ) => {
    const title =
      label === 'Archivar' ? '¿Archivar este producto?' : `¿${label} este producto?`
    const description =
      label === 'Archivar'
        ? 'El producto dejará de aparecer en el catálogo activo. Podrás recuperarlo después desde los productos archivados.'
        : `Se va a ${label.toLowerCase()} el producto seleccionado.`
    setPendingAction({ kind, id, label, title, description })
  }
  const confirmAction = () => {
    if (!pendingAction) return
    const { kind, id } = pendingAction
    const successMessage = {
      activate: 'Producto activado.',
      deactivate: 'Producto desactivado.',
      delete: 'Producto archivado.',
      restore: 'Producto restaurado.',
    }[kind]
    void mutations[kind]
      .mutateAsync(id)
      .then(() => toast.success(successMessage))
      .catch((error: unknown) =>
        toast.error(getAdminErrorMessage(error, 'No se pudo completar la operación.')),
      )
      .finally(() => setPendingAction(null))
  }
  return (
    <>
      <PageHeading
        title="Productos"
        description="Administra el catálogo, el estado y la disponibilidad comercial."
        action={
          <Link
            to="/products/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700"
          >
            <PackagePlus className="size-4" /> Nuevo producto
          </Link>
        }
      />
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_180px]">
          <label className="relative lg:col-span-1">
            <span className="sr-only">Buscar productos</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.search}
              onChange={(event) => update({ search: event.target.value, page: 1 })}
              placeholder="Buscar por nombre, SKU o código de barras…"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
          </label>
          <input
            aria-label="Filtrar por SKU"
            value={filters.sku}
            onChange={(event) => update({ sku: event.target.value, page: 1 })}
            placeholder="SKU"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
          <select
            aria-label="Filtrar por categoría"
            value={filters.category}
            onChange={(event) => update({ category: event.target.value, page: 1 })}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          >
            <option value="">Todas las categorías</option>
            {categoryQuery.data?.results.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por estado"
            value={filters.is_active}
            onChange={(event) => update({ is_active: event.target.value, page: 1 })}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          >
            <option value="">Todos los estados</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>
        <label className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={filters.include_deleted}
            onChange={(event) =>
              update({ include_deleted: event.target.checked, page: 1 })
            }
            className="size-4 rounded border-slate-300 text-brand-600"
          />{' '}
          Incluir productos archivados
        </label>
      </section>
      <AdminTable
        headers={['Producto', 'Categoría', 'Stock', 'Estado', 'Actualizado', 'Acciones']}
        loading={query.isLoading}
        error={
          query.error
            ? getAdminErrorMessage(query.error, 'No se pudieron cargar los productos.')
            : undefined
        }
        empty={!products.length}
        onRetry={() => void query.refetch()}
      >
        {products.map((product) => (
          <tr key={product.id} className="hover:bg-slate-50/70">
            <td className="px-5 py-4">
              <div className="flex items-center gap-3">
                {product.primary_image ? (
                  <img
                    src={product.primary_image}
                    alt=""
                    className="size-11 rounded-lg object-cover"
                  />
                ) : (
                  <div className="grid size-11 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-400">
                    IMG
                  </div>
                )}
                <div>
                  <Link
                    to={`/products/${product.id}`}
                    className="font-semibold text-slate-800 hover:text-brand-700"
                  >
                    {product.name}
                  </Link>
                  <p className="mt-1 font-mono text-xs text-slate-500">{product.sku}</p>
                </div>
              </div>
            </td>
            <td className="whitespace-nowrap px-5 py-4 text-slate-600">
              {product.category.name}
            </td>
            <td className="whitespace-nowrap px-5 py-4">
              <p className="font-semibold text-slate-700">
                {product.available_stock} disponibles
              </p>
              <p className="text-xs text-slate-400">{product.total_stock} físicos</p>
            </td>
            <td className="whitespace-nowrap px-5 py-4">
              <span
                className={
                  product.deleted_at
                    ? 'rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700'
                    : product.is_active
                      ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700'
                      : 'rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700'
                }
              >
                {product.deleted_at
                  ? 'Archivado'
                  : product.is_active
                    ? 'Activo'
                    : 'Inactivo'}
              </span>
            </td>
            <td className="whitespace-nowrap px-5 py-4 text-slate-500">
              {new Date(product.updated_at).toLocaleDateString('es-BO')}
            </td>
            <td className="whitespace-nowrap px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to={`/products/${product.id}`}
                  title="Ver detalle"
                  className="text-brand-600 hover:text-brand-800"
                >
                  <Eye className="size-4" />
                </Link>
                <Link
                  to={`/products/${product.id}/edit`}
                  className="text-xs font-bold text-brand-600 hover:text-brand-800"
                >
                  Editar
                </Link>
                {product.deleted_at ? (
                  <button
                    type="button"
                    onClick={() => action('restore', product.id, 'Restaurar')}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800"
                  >
                    Restaurar
                  </button>
                ) : (
                  <>
                    {product.is_active ? (
                      <button
                        type="button"
                        onClick={() => action('deactivate', product.id, 'Desactivar')}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800"
                      >
                        Desactivar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => action('activate', product.id, 'Activar')}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800"
                      >
                        Activar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => action('delete', product.id, 'Archivar')}
                      className="text-xs font-bold text-red-600 hover:text-red-800"
                    >
                      Archivar
                    </button>
                  </>
                )}
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
        open={Boolean(pendingAction)}
        title={pendingAction?.title ?? ''}
        description={pendingAction?.description ?? ''}
        confirmLabel={pendingAction?.label ?? 'Confirmar'}
        danger={pendingAction?.kind === 'delete'}
        pending={Object.values(mutations).some((mutation) => mutation.isPending)}
        onClose={() => setPendingAction(null)}
        onConfirm={confirmAction}
      />
    </>
  )
}
