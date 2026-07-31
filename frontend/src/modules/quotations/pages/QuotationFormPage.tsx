import { History, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeading } from '../../../components/common/PageHeading'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { catalogService } from '../../catalog/services/catalog.service'
import { useProducts } from '../../catalog/hooks/useCatalogQueries'
import { useClients } from '../../clients/hooks/useClients'
import type { Client } from '../../clients/types/client.types'
import { useQuotation, useQuotationMutations, useQuotationTemplates } from '../hooks/useQuotations'
import type { QuotationStatus, QuotationWriteRequest } from '../types/quotation.types'

type Line = {
  product: string
  sku: string
  name: string
  quantity: number
  normal: number
  special: number | null
  final: number
  level: string
}
const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100'
const money = (value: number) => `Bs ${value.toFixed(2)}`
export const totalQuotationQuantity = (items: Array<{ quantity: number }>) =>
  items.reduce((total, item) => total + item.quantity, 0)
export const quotationPricingRequests = (
  items: Array<{ product: string; quantity: number }>,
  client?: string,
) => {
  const totalQuantity = totalQuotationQuantity(items)
  return items.map((item) => ({
    product: item.product,
    params: {
      quantity: item.quantity,
      total_quantity: totalQuantity,
      client: client || undefined,
    },
  }))
}

export function QuotationFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const editing = Boolean(id)
  const quotation = useQuotation(id)
  const mutations = useQuotationMutations()
  const templates = useQuotationTemplates()
  const [clientSearch, setClientSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const clients = useClients({
    search: clientSearch,
    page: 1,
    ordering: 'name',
    is_active: true,
  })
  const products = useProducts({
    search: productSearch,
    category: '',
    sku: '',
    is_active: 'true',
    include_deleted: false,
    ordering: 'name',
    page: 1,
  })
  const [clientId, setClientId] = useState('')
  const [clientName, setClientName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [validDays, setValidDays] = useState(7)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<QuotationStatus>('issued')
  const [template, setTemplate] = useState<number | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const pricingRequest = useRef(0)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!quotation.data) return
    const value = quotation.data
    setClientId(value.client ?? '')
    setClientName(value.client_name)
    setTaxId(value.client_tax_id)
    setPhone(value.client_phone)
    setAddress(value.client_address)
    setValidDays(value.valid_days)
    setNotes(value.notes)
    setStatus(value.status)
    setTemplate(value.template)
    pricingRequest.current += 1
    setLines(
      value.items.map((item) => ({
        product: item.product ?? '',
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        normal: Number(item.normal_unit_price),
        special: item.special_unit_price ? Number(item.special_unit_price) : null,
        final: Number(item.unit_price),
        level: item.applied_price_level,
      })),
    )
  }, [quotation.data])
  /* eslint-enable react-hooks/set-state-in-effect */
  const totals = useMemo(
    () =>
      lines.reduce(
        (current, line) => ({
          normal: current.normal + line.normal * line.quantity,
          final: current.final + line.final * line.quantity,
        }),
        { normal: 0, final: 0 },
      ),
    [lines],
  )
  const activeTemplates = useMemo(
    () =>
      [...(templates.data ?? [])]
        .filter((item) => item.is_active)
        .sort(
          (left, right) =>
            Number(right.is_default) - Number(left.is_default) ||
            left.name.localeCompare(right.name, 'es'),
        ),
    [templates.data],
  )
  const selectedTemplate =
    template ??
    (!editing
      ? activeTemplates.find((item) => item.is_default)?.id ?? null
      : null)
  const recalculateLines = (nextLines: Line[], client = clientId) => {
    setLines(nextLines)
    const requestId = pricingRequest.current + 1
    pricingRequest.current = requestId
    if (!nextLines.length) return
    void Promise.all(
      quotationPricingRequests(nextLines, client).map((request) =>
        catalogService.getQuotationPrice(request.product, request.params),
      ),
    )
      .then((prices) => {
        if (pricingRequest.current !== requestId) return
        setLines(
          nextLines.map((line, index) => {
            const price = prices[index]
            return {
              ...line,
              normal: Number(price.normal_unit_price),
              special: price.special_unit_price
                ? Number(price.special_unit_price)
                : null,
              final: Number(price.final_unit_price),
              level: price.price_tier?.label ?? price.price_level?.name ?? '',
            }
          }),
        )
      })
      .catch((error: unknown) => {
        if (pricingRequest.current === requestId)
          toast.error(getAdminErrorMessage(error, 'No se pudo calcular el precio.'))
      })
  }
  const selectClient = (client: Client) => {
    setClientId(client.id)
    setClientName(client.name)
    setTaxId(client.tax_id)
    setPhone(client.whatsapp)
    setAddress(`${client.city_zone}, ${client.department}`)
    setClientSearch('')
    recalculateLines(lines, client.id)
  }
  const addProduct = (product: NonNullable<typeof products.data>['results'][number]) => {
    if (lines.some((line) => line.product === product.id)) {
      toast.message('Ese producto ya está agregado.')
      return
    }
    const line: Line = {
      product: product.id,
      sku: product.sku,
      name: product.name,
      quantity: 1,
      normal: 0,
      special: null,
      final: 0,
      level: '',
    }
    recalculateLines([...lines, line])
    setProductSearch('')
  }
  const updateLine = (index: number, value: number) => {
    const next = lines.map((line, position) =>
      position === index ? { ...line, quantity: value } : line,
    )
    recalculateLines(next)
  }
  const submit = () => {
    if (!clientName.trim() || !lines.length) {
      toast.error('Selecciona un cliente y agrega al menos un producto.')
      return
    }
    const payload: QuotationWriteRequest = {
      client: clientId || null,
      client_name: clientName,
      client_tax_id: taxId,
      client_phone: phone,
      client_address: address,
      template: selectedTemplate,
      valid_days: validDays,
      notes,
      status,
      items: lines.map((line) => ({
        product: line.product,
        quantity: line.quantity,
      })),
    }
    const request = editing
      ? mutations.update.mutateAsync({ id: id ?? '', payload })
      : mutations.create.mutateAsync(payload)
    void request
      .then((created) => {
        toast.success('Cotización guardada.')
        navigate(`/quotations/${created.id}`)
      })
      .catch((error: unknown) =>
        toast.error(getAdminErrorMessage(error, 'No se pudo guardar la cotización.')),
      )
  }
  const pending = mutations.create.isPending || mutations.update.isPending
  return (
    <>
      <PageHeading
        title={editing ? 'Editar cotización' : 'Nueva cotización'}
        description="Busca al cliente y los productos; los precios, niveles y totales se calculan solos."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/quotations/templates"
              className="inline-flex items-center gap-2 rounded-xl border border-brand-200 px-4 py-3 text-sm font-bold text-brand-700"
            >
              Plantillas
            </Link>
            <Link
              to="/quotations/history"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
            >
              <History className="size-4" /> Ver historial
            </Link>
          </div>
        }
      />
      {editing && quotation.isLoading ? (
        <p className="text-sm text-slate-500">Cargando cotización…</p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_19rem]">
          <main className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold">1. Buscar cliente</h3>
              <p className="mt-1 text-sm text-slate-500">
                Busca por nombre, razón social, NIT/CI, teléfono o cualquier dato
                registrado.
              </p>
              <input
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
                placeholder="Escribe para buscar un cliente…"
                className={inputClass}
              />
              {clientSearch && (
                <div className="mt-2 divide-y rounded-xl border border-slate-200">
                  {clients.data?.results.map((client) => (
                    <button
                      type="button"
                      key={client.id}
                      onClick={() => selectClient(client)}
                      className="block w-full px-3 py-2.5 text-left hover:bg-brand-50"
                    >
                      <b>{client.name}</b>
                      <span className="ml-2 text-xs text-slate-500">
                        {client.tax_id} · {client.whatsapp}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="text-sm">
                  Cliente
                  <input
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm">
                  NIT/CI
                  <input
                    value={taxId}
                    onChange={(event) => setTaxId(event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm">
                  Teléfono
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold">2. Agregar productos</h3>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" />
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Buscar por nombre, código o SKU…"
                  className={`${inputClass} pl-9`}
                />
                {productSearch && (
                  <div className="mt-2 divide-y rounded-xl border border-slate-200">
                    {products.data?.results.map((product) => (
                      <button
                        type="button"
                        key={product.id}
                        onClick={() => addProduct(product)}
                        className="block w-full px-3 py-2.5 text-left hover:bg-brand-50"
                      >
                        <b>{product.name}</b>
                        <span className="ml-2 font-mono text-xs text-slate-500">
                          {product.sku}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!lines.length ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Busca y selecciona un producto para comenzar.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="pb-3">Producto</th>
                        <th className="pb-3 text-right">Normal</th>
                        <th className="pb-3 text-right">Nivel / especial</th>
                        <th className="pb-3 text-right">Cant.</th>
                        <th className="pb-3 text-right">Final</th>
                        <th className="pb-3 text-right">Subtotal</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, index) => (
                        <tr key={line.product} className="border-b border-slate-100">
                          <td className="py-3">
                            <b>{line.name}</b>
                            <small className="block font-mono text-slate-500">
                              {line.sku}
                            </small>
                          </td>
                          <td className="py-3 text-right">{money(line.normal)}</td>
                          <td className="py-3 text-right">
                            {line.level ? (
                              <>
                                <b className="text-brand-700">{line.level}</b>
                                <small className="block">
                                  {money(line.special ?? line.normal)}
                                </small>
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <input
                              aria-label="Cantidad"
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(event) =>
                                updateLine(index, Math.max(1, Number(event.target.value)))
                              }
                              className="w-16 rounded-lg border px-2 py-1 text-right"
                            />
                          </td>
                          <td className="py-3 text-right font-semibold">
                            {money(line.final)}
                          </td>
                          <td className="py-3 text-right font-bold">
                            {money(line.final * line.quantity)}
                            <small className="block font-normal text-emerald-700">
                              Ahorro {money((line.normal - line.final) * line.quantity)}
                            </small>
                          </td>
                          <td className="py-3 pl-3">
                            <button
                              type="button"
                              aria-label="Quitar producto"
                              onClick={() =>
                                recalculateLines(
                                  lines.filter((_, position) => position !== index),
                                )
                              }
                              className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </main>
          <aside className="h-fit rounded-2xl border border-brand-100 bg-brand-50 p-5">
            <h3 className="font-bold text-brand-900">Resumen</h3>
            <label className="mt-4 block text-sm font-semibold text-brand-900">
              Plantilla del documento
              <select
                value={selectedTemplate ?? ''}
                onChange={(event) => setTemplate(event.target.value ? Number(event.target.value) : null)}
                className={inputClass}
              >
                <option value="">Selecciona una plantilla guardada</option>
                {activeTemplates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.is_default ? ' · Predeterminada' : ''}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-brand-900/70">
                Define las secciones que se mostrarán en el PDF.
              </span>
            </label>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal normal</dt>
                <dd>{money(totals.normal)}</dd>
              </div>
              <div className="flex justify-between text-emerald-700">
                <dt>Descuento / ahorro</dt>
                <dd>-{money(totals.normal - totals.final)}</dd>
              </div>
              <div className="flex justify-between border-t border-brand-200 pt-3 text-lg font-bold text-brand-900">
                <dt>Total final</dt>
                <dd>{money(totals.final)}</dd>
              </div>
            </dl>
            <label className="mt-5 block text-sm font-semibold text-brand-900">
              Vigencia (días)
              <input
                type="number"
                min="1"
                value={validDays}
                onChange={(event) =>
                  setValidDays(Math.max(1, Number(event.target.value)))
                }
                className={inputClass}
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-brand-900">
              Estado
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as QuotationStatus)}
                className={inputClass}
              >
                <option value="draft">Borrador</option>
                <option value="issued">Emitida</option>
                <option value="cancelled">Anulada</option>
              </select>
            </label>
            <label className="mt-4 block text-sm font-semibold text-brand-900">
              Notas
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className={inputClass}
              />
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={submit}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              <Plus className="size-4" /> {pending ? 'Guardando…' : 'Guardar cotización'}
            </button>
          </aside>
        </div>
      )}
    </>
  )
}
