import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Hash,
  History,
  Plus,
  Search,
  Settings2,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeading } from '../../../components/common/PageHeading'
import { useAuthStore } from '../../../store/authStore'
import { hasPermission } from '../../../utils/permissions'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { catalogService } from '../../catalog/services/catalog.service'
import { useProducts } from '../../catalog/hooks/useCatalogQueries'
import { useClients } from '../../clients/hooks/useClients'
import { clientService } from '../../clients/services/client.service'
import type { Client, ClientType } from '../../clients/types/client.types'
import type { PriceLevel } from '../../catalog/types/catalog.types'
import {
  useQuotation,
  useQuotationMutations,
  useQuotationTemplates,
} from '../hooks/useQuotations'
import type { QuotationStatus, QuotationWriteRequest } from '../types/quotation.types'

type Line = {
  product: string
  sku: string
  name: string
  quantity: number
  serialNumbers: string[]
  normal: number
  special: number | null
  final: number
  level: string
  manualPrice: boolean
}
type QuickClientForm = {
  name: string
  tax_id: string
  whatsapp: string
  client_type: string
  price_level: string
}
const emptyQuickClient: QuickClientForm = {
  name: '',
  tax_id: '',
  whatsapp: '',
  client_type: '',
  price_level: '',
}
const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100'
const money = (value: number) => `Bs ${value.toFixed(2)}`
export const localDateValue = (value = new Date()) => {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}
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
  const user = useAuthStore((state) => state.user)
  const canConfigureDocument = hasPermission(
    user,
    'quotations.configure_quotation_document',
  )
  const canManageTemplates = hasPermission(user, 'quotations.manage_quotation_templates')
  const canViewHistory = hasPermission(user, 'quotations.view_quotation')
  const canCreateClient = hasPermission(user, 'clients.add_client')
  const canEditItemPrice = hasPermission(user, 'quotations.change_quotation_item_price')
  const quotation = useQuotation(id)
  const mutations = useQuotationMutations()
  const templates = useQuotationTemplates(canConfigureDocument || canManageTemplates)
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
  const [status, setStatus] = useState<QuotationStatus>('pending')
  const [quotationDate, setQuotationDate] = useState(localDateValue)
  const [template, setTemplate] = useState<number | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [quickClientOpen, setQuickClientOpen] = useState(false)
  const [quickClient, setQuickClient] = useState<QuickClientForm>(emptyQuickClient)
  const [quickClientTypes, setQuickClientTypes] = useState<ClientType[]>([])
  const [quickClientLevels, setQuickClientLevels] = useState<PriceLevel[]>([])
  const [quickClientLoading, setQuickClientLoading] = useState(false)
  const [quickClientSaving, setQuickClientSaving] = useState(false)
  const [quickClientError, setQuickClientError] = useState('')
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
    setQuotationDate(value.quotation_date)
    setTemplate(value.template)
    pricingRequest.current += 1
    setLines(
      value.items.map((item) => ({
        product: item.product ?? '',
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        serialNumbers: item.serial_numbers,
        normal: Number(item.normal_unit_price),
        special: item.special_unit_price ? Number(item.special_unit_price) : null,
        final: Number(item.unit_price),
        level: item.applied_price_level,
        manualPrice: item.price_manually_set,
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
    (!editing ? (activeTemplates.find((item) => item.is_default)?.id ?? null) : null)
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
              special: price.special_unit_price ? Number(price.special_unit_price) : null,
              final: line.manualPrice ? line.final : Number(price.final_unit_price),
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
  const updateQuickClient = (field: keyof QuickClientForm, value: string) =>
    setQuickClient((current) => ({ ...current, [field]: value }))
  const openQuickClient = () => {
    setQuickClientOpen(true)
    setQuickClientError('')
    setQuickClientLoading(true)
    void Promise.all([
      clientService.listTypes(),
      catalogService.listPriceLevels({
        search: '',
        category: '',
        sku: '',
        is_active: 'true',
        include_deleted: false,
        ordering: 'name',
        page: 1,
      }),
    ])
      .then(([typesResponse, levelsResponse]) => {
        const activeTypes = typesResponse.results.filter((item) => item.is_active)
        const activeLevels = levelsResponse.results.filter((item) => item.is_active)
        const preferredLevel =
          activeLevels.find(
            (item) =>
              item.name.toLocaleLowerCase('es') === 'minorista' ||
              item.code.toLocaleLowerCase('es') === 'minorista',
          ) ?? activeLevels[0]
        setQuickClientTypes(activeTypes)
        setQuickClientLevels(activeLevels)
        setQuickClient((current) => ({
          ...current,
          client_type: current.client_type || activeTypes[0]?.name || '',
          price_level: current.price_level || preferredLevel?.id || '',
        }))
      })
      .catch((error: unknown) =>
        setQuickClientError(
          getAdminErrorMessage(error, 'No se pudieron cargar las opciones del cliente.'),
        ),
      )
      .finally(() => setQuickClientLoading(false))
  }
  const saveQuickClient = () => {
    const values = Object.fromEntries(
      Object.entries(quickClient).map(([key, value]) => [key, value.trim()]),
    ) as QuickClientForm
    if (
      !values.name ||
      !values.tax_id ||
      !values.whatsapp ||
      !values.client_type ||
      !values.price_level
    ) {
      setQuickClientError('Completa todos los campos para crear el cliente.')
      return
    }
    setQuickClientSaving(true)
    setQuickClientError('')
    void clientService
      .create({
        ...values,
        department: 'No especificado',
        city_zone: 'No especificado',
        business_activity: 'No especificado',
        observations: 'Cliente creado rápidamente desde una cotización.',
        is_active: true,
      })
      .then((created) => {
        selectClient(created)
        setQuickClient(emptyQuickClient)
        setQuickClientOpen(false)
        void clients.refetch()
        toast.success('Cliente creado y seleccionado.')
      })
      .catch((error: unknown) =>
        setQuickClientError(getAdminErrorMessage(error, 'No se pudo crear el cliente.')),
      )
      .finally(() => setQuickClientSaving(false))
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
      serialNumbers: [''],
      normal: 0,
      special: null,
      final: 0,
      level: '',
      manualPrice: false,
    }
    recalculateLines([...lines, line])
    setProductSearch('')
  }
  const updateLine = (index: number, value: number) => {
    const next = lines.map((line, position) =>
      position === index
        ? {
            ...line,
            quantity: value,
            serialNumbers: Array.from(
              { length: value },
              (_, serialIndex) => line.serialNumbers[serialIndex] ?? '',
            ),
          }
        : line,
    )
    recalculateLines(next)
  }
  const updateSerialNumber = (lineIndex: number, serialIndex: number, value: string) =>
    setLines((current) =>
      current.map((line, position) =>
        position === lineIndex
          ? {
              ...line,
              serialNumbers: line.serialNumbers.map((serial, index) =>
                index === serialIndex ? value : serial,
              ),
            }
          : line,
      ),
    )
  const updateManualPrice = (lineIndex: number, value: number) =>
    setLines((current) =>
      current.map((line, position) =>
        position === lineIndex
          ? { ...line, final: Math.max(0, value), manualPrice: true }
          : line,
      ),
    )
  const restoreAutomaticPrice = (lineIndex: number) => {
    const next = lines.map((line, position) =>
      position === lineIndex ? { ...line, manualPrice: false } : line,
    )
    recalculateLines(next)
  }
  const submit = () => {
    if (!clientName.trim() || !lines.length) {
      toast.error('Selecciona un cliente y agrega al menos un producto.')
      return
    }
    const serialNumbers = lines.flatMap((line) =>
      line.serialNumbers.map((serial) => serial.trim()),
    )
    if (serialNumbers.some((serial) => !serial)) {
      toast.error('Registra un número de serie por cada unidad antes de guardar.')
      return
    }
    const payload: QuotationWriteRequest = {
      client: clientId || null,
      client_name: clientName,
      client_tax_id: taxId,
      client_phone: phone,
      client_address: address,
      ...(canConfigureDocument
        ? { template: selectedTemplate, valid_days: validDays }
        : {}),
      notes,
      status,
      quotation_date: quotationDate,
      items: lines.map((line) => ({
        product: line.product,
        quantity: line.quantity,
        serial_numbers: line.serialNumbers.map((serial) => serial.trim()),
        ...(canEditItemPrice
          ? { manual_unit_price: line.manualPrice ? line.final : null }
          : {}),
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
            {canManageTemplates && (
              <Link
                to="/quotations/templates"
                className="inline-flex items-center gap-2 rounded-xl border border-brand-200 px-4 py-3 text-sm font-bold text-brand-700"
              >
                Plantillas
              </Link>
            )}
            {canViewHistory && (
              <Link
                to="/quotations/history"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
              >
                <History className="size-4" /> Ver historial
              </Link>
            )}
          </div>
        }
      />
      {editing && quotation.isLoading ? (
        <p className="text-sm text-slate-500">Cargando cotización…</p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_19rem]">
          <main className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">1. Buscar cliente</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Busca por nombre, razón social, NIT/CI, teléfono o cualquier dato
                    registrado.
                  </p>
                </div>
                {canCreateClient && (
                  <button
                    type="button"
                    onClick={openQuickClient}
                    className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-100"
                  >
                    <UserPlus className="size-4" /> Nuevo cliente
                  </button>
                )}
              </div>
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
              <p className="mt-1 text-sm text-slate-500">
                Registra el número de serie físico de cada unidad. Si agregas 3 unidades,
                aparecerán 3 campos diferentes.
              </p>
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
                        <Fragment key={line.product}>
                          <tr>
                            <td className="pt-4 align-top">
                              <b>{line.name}</b>
                              <small className="block font-mono text-slate-500">
                                {line.sku}
                              </small>
                            </td>
                            <td className="pt-4 text-right align-top">
                              {money(line.normal)}
                            </td>
                            <td className="pt-4 text-right align-top">
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
                            <td className="pt-4 text-right align-top">
                              <input
                                aria-label="Cantidad"
                                type="number"
                                min="1"
                                value={line.quantity}
                                onChange={(event) =>
                                  updateLine(
                                    index,
                                    Math.max(1, Number(event.target.value)),
                                  )
                                }
                                className="w-16 rounded-lg border px-2 py-1 text-right"
                              />
                            </td>
                            <td className="pt-4 text-right align-top font-semibold">
                              {canEditItemPrice ? (
                                <div className="ml-auto w-28">
                                  <div className="relative">
                                    <span className="pointer-events-none absolute left-2 top-1.5 text-xs text-slate-400">
                                      Bs
                                    </span>
                                    <input
                                      aria-label={`Precio unitario final de ${line.name}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={line.final}
                                      onChange={(event) =>
                                        updateManualPrice(
                                          index,
                                          Number(event.target.value),
                                        )
                                      }
                                      className={`w-full rounded-lg border py-1 pl-7 pr-2 text-right font-semibold outline-none focus:ring-2 ${
                                        line.manualPrice
                                          ? 'border-amber-300 bg-amber-50 focus:border-amber-400 focus:ring-amber-100'
                                          : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
                                      }`}
                                    />
                                  </div>
                                  {line.manualPrice ? (
                                    <button
                                      type="button"
                                      onClick={() => restoreAutomaticPrice(index)}
                                      className="mt-1 text-[11px] font-semibold text-brand-700 hover:underline"
                                    >
                                      Usar automático
                                    </button>
                                  ) : (
                                    <small className="mt-1 block text-[11px] font-normal text-slate-500">
                                      Automático
                                    </small>
                                  )}
                                </div>
                              ) : (
                                money(line.final)
                              )}
                            </td>
                            <td className="pt-4 text-right align-top font-bold">
                              {money(line.final * line.quantity)}
                              <small className="block font-normal text-emerald-700">
                                Ahorro {money((line.normal - line.final) * line.quantity)}
                              </small>
                            </td>
                            <td className="pt-3 pl-3 align-top">
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
                          <tr className="border-b border-slate-100">
                            <td colSpan={7} className="pb-4 pt-3">
                              <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="grid size-8 place-items-center rounded-lg bg-white text-brand-700 shadow-sm">
                                      <Hash className="size-4" />
                                    </span>
                                    <div>
                                      <p className="text-xs font-bold text-brand-900">
                                        Ingrese el N° Serie
                                      </p>
                                    </div>
                                  </div>
                                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-brand-700">
                                    {
                                      line.serialNumbers.filter((serial) => serial.trim())
                                        .length
                                    }
                                    /{line.quantity} completos
                                  </span>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                  {line.serialNumbers.map((serial, serialIndex) => (
                                    <label
                                      key={serialIndex}
                                      className="rounded-lg border border-slate-200 bg-white p-2 text-[11px] font-semibold text-slate-600"
                                    >
                                      Unidad {serialIndex + 1}
                                      <input
                                        aria-label={`Número de serie ${serialIndex + 1} de ${line.name}`}
                                        value={serial}
                                        maxLength={120}
                                        onChange={(event) =>
                                          updateSerialNumber(
                                            index,
                                            serialIndex,
                                            event.target.value,
                                          )
                                        }
                                        placeholder="Ingrese el N° Serie"
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                                      />
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        </Fragment>
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
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="size-4" /> Fecha de la cotización
              </span>
              <input
                type="date"
                required
                value={quotationDate}
                onChange={(event) => setQuotationDate(event.target.value)}
                className={inputClass}
              />
              <span className="mt-1.5 block text-xs font-normal text-brand-900/65">
                Se muestra en el documento y por defecto corresponde a hoy.
              </span>
            </label>
            <fieldset className="mt-4">
              <legend className="text-sm font-semibold text-brand-900">Estado</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('pending')}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                    status === 'pending'
                      ? 'border-amber-300 bg-amber-100 text-amber-900 ring-2 ring-amber-100'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Clock3 className="size-4" /> Pendiente
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('paid')}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                    status === 'paid'
                      ? 'border-emerald-300 bg-emerald-100 text-emerald-900 ring-2 ring-emerald-100'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2 className="size-4" /> Pagada
                </button>
              </div>
            </fieldset>
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
            {canConfigureDocument ? (
              <details className="mt-5 rounded-xl border border-brand-200 bg-white/80 p-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-brand-900">
                  <Settings2 className="size-4" /> Configuración del documento
                </summary>
                <div className="mt-3 border-t border-brand-100 pt-3">
                  <label className="block text-sm font-semibold text-brand-900">
                    Plantilla
                    <select
                      value={selectedTemplate ?? ''}
                      onChange={(event) =>
                        setTemplate(
                          event.target.value ? Number(event.target.value) : null,
                        )
                      }
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
                  </label>
                  <label className="mt-3 block text-sm font-semibold text-brand-900">
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
                  <p className="mt-2 text-xs leading-5 text-brand-900/65">
                    Estas opciones solo afectan la presentación y vigencia del documento.
                  </p>
                </div>
              </details>
            ) : (
              <p className="mt-5 rounded-xl border border-brand-100 bg-white/70 p-3 text-xs leading-5 text-brand-900/70">
                Se usará automáticamente la plantilla y vigencia predeterminadas.
              </p>
            )}
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
      {quickClientOpen && canCreateClient && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-client-title"
            onSubmit={(event) => {
              event.preventDefault()
              saveQuickClient()
            }}
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="quick-client-title" className="text-lg font-bold text-slate-900">
                  Crear cliente rápido
                </h3>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  Registra los datos necesarios para continuar. Podrás completar su
                  información después desde Clientes.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setQuickClientOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <QuickClientField label="Nombre o razón social" fullWidth>
                <input
                  autoFocus
                  value={quickClient.name}
                  maxLength={200}
                  onChange={(event) => updateQuickClient('name', event.target.value)}
                  className={inputClass}
                />
              </QuickClientField>
              <QuickClientField label="NIT/CI">
                <input
                  value={quickClient.tax_id}
                  maxLength={30}
                  onChange={(event) => updateQuickClient('tax_id', event.target.value)}
                  className={inputClass}
                />
              </QuickClientField>
              <QuickClientField label="Teléfono o WhatsApp">
                <input
                  value={quickClient.whatsapp}
                  maxLength={30}
                  onChange={(event) => updateQuickClient('whatsapp', event.target.value)}
                  className={inputClass}
                />
              </QuickClientField>
              <QuickClientField label="Tipo de cliente">
                <select
                  value={quickClient.client_type}
                  disabled={quickClientLoading}
                  onChange={(event) =>
                    updateQuickClient('client_type', event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">Selecciona un tipo</option>
                  {quickClientTypes.map((type) => (
                    <option key={type.id} value={type.name}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </QuickClientField>
              <QuickClientField label="Nivel de precio">
                <select
                  value={quickClient.price_level}
                  disabled={quickClientLoading}
                  onChange={(event) =>
                    updateQuickClient('price_level', event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">Selecciona un nivel</option>
                  {quickClientLevels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </QuickClientField>
            </div>
            {quickClientError && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {quickClientError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={quickClientSaving}
                onClick={() => setQuickClientOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={quickClientLoading || quickClientSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                <UserPlus className="size-4" />
                {quickClientSaving ? 'Creando…' : 'Crear y seleccionar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

function QuickClientField({
  label,
  fullWidth = false,
  children,
}: {
  label: string
  fullWidth?: boolean
  children: React.ReactNode
}) {
  return (
    <label
      className={`block text-sm font-semibold text-slate-700 ${fullWidth ? 'sm:col-span-2' : ''}`}
    >
      {label}
      {children}
    </label>
  )
}
