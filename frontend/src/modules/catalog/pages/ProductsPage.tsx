import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowDownToLine, DollarSign, Eye, PackagePlus, Search } from 'lucide-react'

import { PageHeading } from '../../../components/common/PageHeading'
import { AdminTable, Pagination } from '../../admin/components/AdminTable'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { ProductPricesModal } from '../components/ProductPricesModal'
import { useCatalogFilters } from '../hooks/useCatalogFilters'
import { useCategories, useProduct, useProducts } from '../hooks/useCatalogQueries'
import { useAuthStore } from '../../../store/authStore'
import { hasAnyPermission, hasPermission } from '../../../utils/permissions'

export function ProductsPage() {
  const location = useLocation()
  const { filters, update } = useCatalogFilters()
  const user = useAuthStore((state) => state.user)
  const query = useProducts(filters)
  const categoryQuery = useCategories({
    ...filters,
    search: '',
    page: 1,
    is_active: 'true',
  })
  const [pricingProductId, setPricingProductId] = useState<string | undefined>()
  const pricingProductQuery = useProduct(pricingProductId)
  const products = query.data?.results ?? []

  return (
    <>
      <PageHeading
        title="Productos"
        description="Administra el catálogo, el estado y la disponibilidad comercial."
        action={
          <div className="flex flex-wrap gap-2">
            {hasAnyPermission(user, ['products.view_product', 'products.add_product']) && (
              <Link
                to={{ pathname: '/products/import-export', search: location.search }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-200 px-4 py-3 text-sm font-bold text-brand-700 hover:bg-brand-50"
              >
                Importar / exportar
              </Link>
            )}
            {hasPermission(user, 'products.add_product') && (
              <Link
                to="/products/new"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700"
              >
                <PackagePlus className="size-4" /> Nuevo producto
              </Link>
            )}
            {hasPermission(user, 'products.view_category') && (
              <Link
                to="/products/categories"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Categorías
              </Link>
            )}
            {hasPermission(user, 'products.view_pricelevel') && (
              <Link
                to="/products/price-levels"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Niveles de precio
              </Link>
            )}
          </div>
        }
      />
      <section className="mb-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
        <h3 className="text-sm font-bold text-brand-900">¿Cómo funciona el catálogo?</h3>
        <p className="mt-1 text-sm leading-6 text-brand-900/75">
          Aquí creas productos y administras sus categorías y niveles de precio. Para sumar
          unidades, usa “Agregar stock” en el producto correspondiente.
        </p>
      </section>
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
            onChange={(event) => update({ include_deleted: event.target.checked, page: 1 })}
            className="size-4 rounded border-slate-300 text-brand-600"
          />
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
                  <img src={product.primary_image} alt="" className="size-11 rounded-lg object-cover" />
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
            <td className="whitespace-nowrap px-5 py-4 text-slate-600">{product.category.name}</td>
            <td className="whitespace-nowrap px-5 py-4">
              <p className="font-semibold text-slate-700">{product.available_stock} disponibles</p>
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
                {product.deleted_at ? 'Archivado' : product.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </td>
            <td className="whitespace-nowrap px-5 py-4 text-slate-500">
              {new Date(product.updated_at).toLocaleDateString('es-BO')}
            </td>
            <td className="whitespace-nowrap px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link to={`/products/${product.id}`} title="Ver detalle" className="text-brand-600 hover:text-brand-800">
                  <Eye className="size-4" />
                </Link>
                {hasPermission(user, 'products.change_product') && (
                  <Link
                    to={`/products/${product.id}/edit`}
                    className="text-xs font-bold text-brand-600 hover:text-brand-800"
                  >
                    Editar
                  </Link>
                )}
                {product.has_stock && hasPermission(user, 'inventory.add_stockmovement') && (
                  <Link
                    to={`/inventory/movements/new?product=${product.id}&type=ENTRY`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900"
                  >
                    <ArrowDownToLine className="size-4" /> Agregar stock
                  </Link>
                )}
                {!product.deleted_at && hasPermission(user, 'products.change_productprice') && (
                  <button
                    type="button"
                    onClick={() => setPricingProductId(product.id)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-800"
                  >
                    <DollarSign className="size-4" /> Precios
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
      {query.data && (
        <Pagination page={filters.page} count={query.data.count} onPageChange={(page) => update({ page })} />
      )}
      {pricingProductQuery.data && (
        <ProductPricesModal
          product={pricingProductQuery.data}
          onClose={() => setPricingProductId(undefined)}
        />
      )}
    </>
  )
}
