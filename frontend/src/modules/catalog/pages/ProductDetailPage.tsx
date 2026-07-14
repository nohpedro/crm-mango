import { Link, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, Edit3, ImageOff, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeading } from '../../../components/common/PageHeading'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { useProduct, useProductMutations } from '../hooks/useCatalogQueries'

export function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useProduct(id)
  const mutations = useProductMutations()
  const [pendingAction, setPendingAction] = useState<{
    action: 'activate' | 'deactivate' | 'delete' | 'restore'
    label: string
    title: string
    description: string
  } | null>(null)
  if (query.isLoading)
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Cargando producto…
      </div>
    )
  if (query.isError || !query.data)
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {getAdminErrorMessage(query.error, 'No se pudo cargar el producto.')}
      </div>
    )
  const product = query.data
  const runAction = (
    action: 'activate' | 'deactivate' | 'delete' | 'restore',
    label: string,
  ) => {
    const isArchive = action === 'delete'
    setPendingAction({
      action,
      label,
      title: isArchive ? '¿Archivar este producto?' : `¿${label} este producto?`,
      description: isArchive
        ? 'El producto dejará de aparecer en el catálogo activo. Podrás recuperarlo después desde los productos archivados.'
        : `Se va a ${label.toLowerCase()} el producto seleccionado.`,
    })
  }
  const confirmAction = () => {
    if (!pendingAction) return
    const { action } = pendingAction
    const successMessage = {
      activate: 'Producto activado.',
      deactivate: 'Producto desactivado.',
      delete: 'Producto archivado.',
      restore: 'Producto restaurado.',
    }[action]
    void mutations[action]
      .mutateAsync(product.id)
      .then(() => {
        toast.success(successMessage)
        if (action === 'delete') navigate('/products')
      })
      .catch((error: unknown) =>
        toast.error(getAdminErrorMessage(error, 'No se pudo completar la operación.')),
      )
      .finally(() => setPendingAction(null))
  }
  return (
    <>
      <PageHeading
        title={product.name}
        description={`SKU ${product.sku} · ${product.category.name}`}
        action={
          <div className="flex gap-2">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-white"
            >
              <ArrowLeft className="size-4" /> Volver
            </Link>
            <Link
              to={`/products/${product.id}/edit`}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700"
            >
              <Edit3 className="size-4" /> Editar
            </Link>
          </div>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            <div className="grid min-h-52 place-items-center overflow-hidden rounded-xl bg-slate-100">
              {product.primary_image ? (
                <img
                  src={product.primary_image}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageOff className="size-10 text-slate-300" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
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
                <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                  {product.category.code}
                </span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-900">{product.name}</h3>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                {product.description || 'Sin descripción.'}
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
                <div>
                  <dt className="text-xs text-slate-400">Stock físico</dt>
                  <dd className="mt-1 text-lg font-bold text-slate-800">
                    {product.total_stock}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Stock disponible</dt>
                  <dd className="mt-1 text-lg font-bold text-emerald-700">
                    {product.available_stock}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h3 className="font-bold text-slate-900">Acciones del producto</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Las operaciones sensibles te pedirán una confirmación clara antes de
            continuar.
          </p>
          <div className="mt-5 grid gap-2">
            {product.deleted_at ? (
              <button
                type="button"
                onClick={() => runAction('restore', 'Restaurar')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="size-4" /> Restaurar producto
              </button>
            ) : (
              <>
                {product.is_active ? (
                  <button
                    type="button"
                    onClick={() => runAction('deactivate', 'Desactivar')}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Desactivar producto
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => runAction('activate', 'Activar')}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Activar producto
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => runAction('delete', 'Archivar')}
                  className="rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Archivar producto
                </button>
              </>
            )}
          </div>
          <div className="mt-6 border-t border-slate-100 pt-5">
            <Link
              to={`/products/${product.id}/prices`}
              className="block text-sm font-bold text-brand-600 hover:text-brand-800"
            >
              Administrar precios →
            </Link>
            <Link
              to={`/products/${product.id}/images`}
              className="mt-3 block text-sm font-bold text-brand-600 hover:text-brand-800"
            >
              Administrar imágenes →
            </Link>
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.title ?? ''}
        description={pendingAction?.description ?? ''}
        confirmLabel={pendingAction?.label ?? 'Confirmar'}
        danger={pendingAction?.action === 'delete'}
        pending={Object.values(mutations).some((mutation) => mutation.isPending)}
        onClose={() => setPendingAction(null)}
        onConfirm={confirmAction}
      />
    </>
  )
}
