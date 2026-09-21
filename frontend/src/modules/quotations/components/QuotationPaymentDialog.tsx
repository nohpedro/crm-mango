import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { quotationService } from '../services/quotation.service'
import type { PaperFormat, Quotation } from '../types/quotation.types'
import { useAuthStore } from '../../../store/authStore'
import { hasPermission } from '../../../utils/permissions'

type SerialEntry = { id: number; serial_numbers: string[]; manual_unit_price?: number }
type PaymentQuotation = Pick<Quotation, 'id' | 'number' | 'client_name'> & {
  items: Array<
    Pick<
      Quotation['items'][number],
      'id' | 'name' | 'sku' | 'quantity' | 'serial_numbers' | 'unit_price'
    >
  >
}

export function QuotationPaymentDialog({
  quotation,
  onClose,
  onSave,
}: {
  quotation: PaymentQuotation
  onClose: (saved?: Quotation) => void
  onSave?: (items: SerialEntry[]) => Promise<Quotation>
}) {
  const cache = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const canEditPrices = hasPermission(user, 'quotations.change_quotation_item_price')
  const [editPrices, setEditPrices] = useState(false)
  const [prices, setPrices] = useState(() =>
    quotation.items.map((item) => item.unit_price),
  )
  const pricesEnabled = editPrices && canEditPrices
  const validPrices =
    !pricesEnabled ||
    prices.every(
      (price) => /^\d{1,10}(\.\d{1,2})?$/.test(price) && Number.isFinite(Number(price)),
    )
  const total =
    quotation.items.reduce(
      (sum, item, index) =>
        sum +
        Math.round(Number(pricesEnabled ? prices[index] : item.unit_price) * 100) *
          item.quantity,
      0,
    ) / 100
  const [items, setItems] = useState(() =>
    quotation.items.map((item) => ({
      id: item.id,
      serial_numbers: Array.from(
        { length: item.quantity },
        (_, index) => item.serial_numbers[index] ?? '',
      ),
    })),
  )
  const [paper, setPaper] = useState<PaperFormat>('standard')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<Quotation | undefined>(undefined)
  const [error, setError] = useState('')
  const complete =
    items.length > 0 &&
    items.every((item) => item.serial_numbers.every((serial) => serial.trim()))
  const confirm = async () => {
    if (busy || (!saved && (!complete || !validPrices))) return
    setBusy(true)
    setError('')
    let paid = saved
    try {
      if (!paid) {
        const entries = items.map((item, index) => ({
          ...item,
          serial_numbers: item.serial_numbers.map((serial) => serial.trim()),
          ...(pricesEnabled ? { manual_unit_price: Number(prices[index]) } : {}),
        }))
        paid = onSave
          ? await onSave(entries)
          : await quotationService.markPaid(String(quotation.id), entries)
        setSaved(paid)
        for (const key of ['quotations', 'quotation', 'dashboard', 'client-analytics']) {
          void cache.invalidateQueries({ queryKey: [key] })
        }
      }
      const blob = await quotationService.downloadPdf(String(paid.id), paper)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `Hoja-venta-${paid.number}-${paper}.pdf`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      onClose(paid)
    } catch (cause) {
      setError(
        paid
          ? 'La cotización quedó Pagada y las series se guardaron. No se pudo generar la hoja de venta; vuelve a intentar la descarga.'
          : getAdminErrorMessage(
              cause,
              'No se pudo guardar. Revisa las series e inténtalo de nuevo.',
            ),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h3 id="payment-title" className="text-lg font-bold text-slate-900">
          Registrar pago y generar hoja de venta
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          {quotation.number} · {quotation.client_name}. Completa una serie por unidad. Se
          generará el documento con la plantilla de la cotización.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void confirm()
          }}
        >
          {canEditPrices && (
            <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={editPrices}
                disabled={busy || Boolean(saved)}
                onChange={(event) => setEditPrices(event.target.checked)}
              />
              Modificar precios de la cotización
            </label>
          )}
          {quotation.items.map((product, index) => (
            <fieldset
              key={product.id}
              disabled={busy || Boolean(saved)}
              className="mt-4 rounded-xl border border-slate-200 p-4"
            >
              <legend className="px-2 text-sm font-bold">
                {product.name} · {product.sku}
              </legend>
              {pricesEnabled ? (
                <label className="mb-3 block text-sm font-semibold">
                  Precio unitario de {product.name} (Bs)
                  <input
                    type="number"
                    min="0"
                    max="9999999999.99"
                    step="0.01"
                    required
                    value={prices[index]}
                    onChange={(event) =>
                      setPrices((current) =>
                        current.map((price, position) =>
                          position === index ? event.target.value : price,
                        ),
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
              ) : (
                <p className="mb-3 text-sm text-slate-600">
                  Precio unitario: Bs {Number(product.unit_price).toFixed(2)} · Cantidad:{' '}
                  {product.quantity}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {items[index].serial_numbers.map((serial, serialIndex) => (
                  <label key={serialIndex} className="text-sm text-slate-700">
                    N° Serie · Unidad {serialIndex + 1}
                    <input
                      autoFocus={index === 0 && serialIndex === 0}
                      required
                      maxLength={120}
                      value={serial}
                      aria-label={`Número de serie ${serialIndex + 1} de ${product.name}`}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((item, position) =>
                            position !== index
                              ? item
                              : {
                                  ...item,
                                  serial_numbers: item.serial_numbers.map(
                                    (value, unit) =>
                                      unit === serialIndex ? event.target.value : value,
                                  ),
                                },
                          ),
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <p className="mt-4 text-right font-bold text-brand-900">
            Total cotización:{' '}
            {validPrices ? `Bs ${total.toFixed(2)}` : 'Revisa los precios'}
          </p>
          <label className="mt-4 block text-sm font-semibold">
            Formato de hoja de venta
            <select
              value={paper}
              disabled={busy}
              onChange={(event) => setPaper(event.target.value as PaperFormat)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="standard">Hoja estándar</option>
              <option value="roll">Papel rollo</option>
            </select>
          </label>
          {error && (
            <p
              role="alert"
              className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => onClose(saved)}
              className="rounded-xl border border-slate-300 px-4 py-2"
            >
              {saved ? 'Cerrar' : 'Cancelar'}
            </button>
            <button
              type="submit"
              disabled={busy || (!saved && (!complete || !validPrices))}
              className="rounded-xl bg-brand-600 px-4 py-2 font-bold text-white disabled:opacity-50"
            >
              {busy
                ? 'Procesando…'
                : saved
                  ? 'Reintentar descarga'
                  : 'Marcar Pagada y generar hoja'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
