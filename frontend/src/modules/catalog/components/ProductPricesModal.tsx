import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { toast } from 'sonner'

import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { catalogQueryKeys, usePriceLevels } from '../hooks/useCatalogQueries'
import { catalogService } from '../services/catalog.service'
import type { ProductDetail } from '../types/catalog.types'

export function ProductPricesModal({
  product,
  onClose,
}: {
  product: ProductDetail
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const levels = usePriceLevels({
    search: '',
    category: '',
    sku: '',
    is_active: 'true',
    include_deleted: false,
    ordering: 'name',
    page: 1,
  })
  const [values, setValues] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const next: Record<string, string> = {}
    levels.data?.results
      .flatMap((level) => level.tiers)
      .forEach((tier) => {
        const configured = product.prices.find((price) => price.price_tier === tier.id)
        next[tier.id] = configured?.unit_price ?? product.normal_unit_price
      })
    setValues(next)
  }, [levels.data, product])
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = () => {
    const specialTiers = (levels.data?.results.flatMap((level) => level.tiers) ?? []).filter(
      (tier) => tier.minimum_quantity > 1,
    )
    setPending(true)
    void Promise.all(
      specialTiers.map((tier) => {
        const existing = product.prices.find((price) => price.price_tier === tier.id)
        const payload = {
          product: product.id,
          price_tier: tier.id,
          unit_price: Number(values[tier.id] ?? 0),
          discount_percent: 0,
          is_active: true,
        }
        return existing
          ? catalogService.updateProductPrice(existing.id, payload)
          : catalogService.createProductPrice(payload)
      }),
    )
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: catalogQueryKeys.product(product.id) })
        toast.success('Precios del producto guardados.')
        onClose()
      })
      .catch((error: unknown) =>
        toast.error(getAdminErrorMessage(error, 'No se pudieron guardar los precios.')),
      )
      .finally(() => setPending(false))
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-prices-title"
        className="mx-auto my-8 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="product-prices-title" className="text-lg font-bold text-slate-900">
              Precios · {product.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              El precio de venta normal siempre corresponde al nivel x1. Configura aquí los
              precios especiales por cantidad.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-5 space-y-5">
          {levels.data?.results.map((level) => (
            <section key={level.id} className="rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-brand-900">{level.name}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {level.tiers.map((tier) => {
                  const isNormalPrice = tier.minimum_quantity === 1
                  return (
                    <label key={tier.id} className="text-sm font-semibold text-slate-700">
                      {tier.label}{' '}
                      <span className="font-normal text-slate-500">
                        (desde {tier.minimum_quantity})
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        readOnly={isNormalPrice}
                        value={isNormalPrice ? product.normal_unit_price : values[tier.id] ?? ''}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [tier.id]: event.target.value,
                          }))
                        }
                        className={`mt-1 w-full rounded-xl border px-3 py-2.5 ${
                          isNormalPrice
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                            : 'border-slate-300'
                        }`}
                      />
                      {isNormalPrice && (
                        <span className="mt-1 block text-xs font-normal text-slate-500">
                          Se modifica desde Editar producto.
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-4 py-2.5 text-sm font-bold"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? 'Guardando…' : 'Guardar precios'}
          </button>
        </div>
      </section>
    </div>
  )
}
