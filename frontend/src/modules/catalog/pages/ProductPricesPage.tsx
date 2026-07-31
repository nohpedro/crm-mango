import { ArrowLeft, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeading } from '../../../components/common/PageHeading'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { usePriceLevels, useProduct } from '../hooks/useCatalogQueries'
import { catalogService } from '../services/catalog.service'

export function ProductPricesPage() {
  const { id } = useParams()
  const product = useProduct(id)
  const levels = usePriceLevels({
    search: '',
    category: '',
    sku: '',
    is_active: 'true',
    include_deleted: false,
    ordering: 'name',
    page: 1,
  })
  const [level, setLevel] = useState('')
  const [price, setPrice] = useState(0)
  const [pending, setPending] = useState(false)
  const save = () => {
    if (!id || !level) {
      toast.error('Selecciona un nivel de precio.')
      return
    }
    setPending(true)
    void catalogService
      .createProductPrice({
        product: id,
        price_tier: level,
        unit_price: price,
        discount_percent: 0,
        is_active: true,
      })
      .then(() => {
        toast.success('Regla de precio creada.')
        void product.refetch()
        setLevel('')
        setPrice(0)
      })
      .catch((error: unknown) =>
        toast.error(getAdminErrorMessage(error, 'No se pudo guardar la regla.')),
      )
      .finally(() => setPending(false))
  }
  if (!product.data)
    return <p className="text-sm text-slate-500">Cargando reglas de precio…</p>
  return (
    <>
      <PageHeading
        title={`Precios · ${product.data.name}`}
        description={`Precio normal: Bs ${Number(product.data.normal_unit_price).toFixed(2)}. Crea reglas por nivel y cantidad para que el cotizador las aplique automáticamente.`}
        action={
          <Link
            to={`/products/${id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
          >
            <ArrowLeft className="size-4" /> Producto
          </Link>
        }
      />
      <section className="mb-5 rounded-2xl border border-brand-100 bg-brand-50 p-5">
        <h3 className="font-bold text-brand-900">Nueva regla de precio</h3>
        <p className="mt-1 text-sm text-brand-900/75">
          Ejemplo: nivel Mayorista, desde 3 unidades, precio especial Bs 15. El cotizador
          sustituirá el precio normal automáticamente.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Nivel
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5"
            >
              <option value="">Selecciona</option>
              {levels.data?.results.flatMap((item) => item.tiers).map((tier) => <option key={tier.id} value={tier.id}>{tier.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Precio especial (Bs)
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(Math.max(0, Number(event.target.value)))}
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          <Plus className="size-4" /> Guardar regla
        </button>
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-4">Nivel</th>
              <th className="px-5 py-4">Cantidad mínima</th>
              <th className="px-5 py-4">Precio especial</th>
            </tr>
          </thead>
          <tbody>
            {product.data.prices.length ? (
              product.data.prices.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-5 py-4 font-semibold">{item.price_tier_detail?.label ?? item.price_level_detail.name}</td>
                  <td className="px-5 py-4">{item.price_tier_detail?.minimum_quantity ?? item.minimum_quantity}</td>
                  <td className="px-5 py-4">Bs {Number(item.unit_price).toFixed(2)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-slate-500">
                  Todavía no hay reglas especiales para este producto.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}
