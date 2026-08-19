import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit,
  FileSpreadsheet,
  FileText,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  Repeat2,
  ShoppingBag,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeading } from '../../../components/common/PageHeading'
import { useAuthStore } from '../../../store/authStore'
import { hasPermission } from '../../../utils/permissions'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { useClientAnalytics } from '../hooks/useDashboard'
import { dashboardService } from '../services/dashboard.service'
import type { DashboardRange, DashboardStatus } from '../types/dashboard.types'

type PeriodKey = '3m' | '6m' | '12m' | 'all' | 'custom'

const money = (value: string | number) =>
  `Bs ${Number(value).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const localIsoDate = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const rangeForMonths = (months: number): Required<DashboardRange> => {
  const today = new Date()
  return {
    start_date: localIsoDate(
      new Date(today.getFullYear(), today.getMonth() - months + 1, 1),
    ),
    end_date: localIsoDate(today),
  }
}

const periodOptions: Array<{ key: PeriodKey; label: string }> = [
  { key: '3m', label: '3 meses' },
  { key: '6m', label: '6 meses' },
  { key: '12m', label: '12 meses' },
  { key: 'all', label: 'Todo el historial' },
  { key: 'custom', label: 'Elegir fechas' },
]

export function ClientAnalyticsPage() {
  const { id } = useParams()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const canEditClient = hasPermission(user, 'clients.change_client')
  const periodParam = searchParams.get('period')
  const period: PeriodKey = ['3m', '6m', '12m', 'all', 'custom'].includes(
    periodParam ?? '',
  )
    ? (periodParam as PeriodKey)
    : '12m'
  const statusParam = searchParams.get('status')
  const status: DashboardStatus = ['all', 'paid', 'pending'].includes(statusParam ?? '')
    ? (statusParam as DashboardStatus)
    : 'all'
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const range: DashboardRange =
    period === 'all'
      ? {}
      : period === 'custom'
        ? {
            start_date: searchParams.get('start_date') || rangeForMonths(12).start_date,
            end_date: searchParams.get('end_date') || rangeForMonths(12).end_date,
          }
        : rangeForMonths(Number(period.replace('m', '')))
  const [rangeDraft, setRangeDraft] = useState<Required<DashboardRange>>(() =>
    period === 'custom' ? (range as Required<DashboardRange>) : rangeForMonths(12),
  )
  const [downloading, setDownloading] = useState<'pdf' | 'csv' | null>(null)
  const origin = (location.state as { returnTo?: string } | null)?.returnTo
  const currentLocation = `${location.pathname}${location.search}`
  const analytics = useClientAnalytics(id, {
    ...range,
    status,
    page,
    page_size: 10,
  })

  const downloadClientReport = async (format: 'pdf' | 'csv') => {
    if (!id) return
    setDownloading(format)
    try {
      const params = { ...range, status }
      const blob =
        format === 'pdf'
          ? await dashboardService.downloadClientPdf(id, params)
          : await dashboardService.downloadClientCsv(id, params)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download =
        format === 'pdf'
          ? `reporte-cliente-${analytics.data?.client.tax_id || id}.pdf`
          : `productos-cliente-${analytics.data?.client.tax_id || id}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success(
        format === 'pdf'
          ? 'Reporte del cliente descargado.'
          : 'Lista de productos descargada.',
      )
    } catch (error) {
      toast.error(getAdminErrorMessage(error, 'No se pudo descargar el reporte.'))
    } finally {
      setDownloading(null)
    }
  }

  const choosePeriod = (nextPeriod: PeriodKey) => {
    const next = new URLSearchParams(searchParams)
    next.set('period', nextPeriod)
    next.delete('page')
    if (nextPeriod !== 'custom') {
      next.delete('start_date')
      next.delete('end_date')
    }
    setSearchParams(next, { state: location.state })
  }

  const applyCustomRange = () => {
    if (!rangeDraft.start_date || !rangeDraft.end_date) return
    if (rangeDraft.start_date > rangeDraft.end_date) return
    const next = new URLSearchParams(searchParams)
    next.set('period', 'custom')
    next.set('start_date', rangeDraft.start_date)
    next.set('end_date', rangeDraft.end_date)
    next.delete('page')
    setSearchParams(next, { state: location.state })
  }

  const selectStatus = (nextStatus: DashboardStatus) => {
    const next = new URLSearchParams(searchParams)
    next.set('status', nextStatus)
    next.delete('page')
    setSearchParams(next, { state: location.state })
  }

  const selectPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams)
    if (nextPage > 1) next.set('page', String(nextPage))
    else next.delete('page')
    setSearchParams(next, { state: location.state })
  }

  return (
    <>
      <PageHeading
        title={analytics.data?.client.name ?? 'Ficha del cliente'}
        description="Compras pagadas, cotizaciones pendientes y comportamiento comercial del cliente."
        action={
          <div className="flex flex-wrap gap-2">
            {analytics.data && (
              <>
                <button
                  type="button"
                  disabled={Boolean(downloading)}
                  onClick={() => void downloadClientReport('pdf')}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {downloading === 'pdf' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                  Reporte PDF
                </button>
                <button
                  type="button"
                  disabled={Boolean(downloading)}
                  onClick={() => void downloadClientReport('csv')}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-700 disabled:opacity-50"
                >
                  {downloading === 'csv' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="size-4" />
                  )}
                  Productos CSV
                </button>
              </>
            )}
            {canEditClient && analytics.data && (
              <Link
                to={`/clients/${analytics.data.client.id}/edit`}
                state={{ returnTo: origin ?? currentLocation }}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm font-bold text-brand-700"
              >
                <Edit className="size-4" /> Editar cliente
              </Link>
            )}
            <Link
              to={origin ?? '/'}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
            >
              <ArrowLeft className="size-4" /> Panel principal
            </Link>
          </div>
        }
      />

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <span className="mr-1 self-center text-sm font-bold text-slate-700">
              Periodo:
            </span>
            {periodOptions.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => choosePeriod(item.key)}
                className={`rounded-xl px-3.5 py-2 text-sm font-bold transition ${
                  period === item.key
                    ? 'bg-brand-700 text-white'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="mr-1 self-center text-sm font-bold text-slate-700">
              Estado:
            </span>
            {(
              [
                ['all', 'Todas'],
                ['paid', 'Pagadas'],
                ['pending', 'Pendientes'],
              ] as Array<[DashboardStatus, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  selectStatus(key)
                }}
                className={`rounded-xl px-3.5 py-2 text-sm font-bold transition ${
                  status === key
                    ? key === 'paid'
                      ? 'bg-emerald-600 text-white'
                      : key === 'pending'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-800 text-white'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {period === 'custom' && (
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-sm font-semibold text-slate-700">
              Desde
              <input
                type="date"
                value={rangeDraft.start_date}
                max={rangeDraft.end_date}
                onChange={(event) =>
                  setRangeDraft((current) => ({
                    ...current,
                    start_date: event.target.value,
                  }))
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Hasta
              <input
                type="date"
                value={rangeDraft.end_date}
                min={rangeDraft.start_date}
                onChange={(event) =>
                  setRangeDraft((current) => ({
                    ...current,
                    end_date: event.target.value,
                  }))
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"
              />
            </label>
            <button
              type="button"
              onClick={applyCustomRange}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white"
            >
              <CalendarDays className="size-4" /> Aplicar fechas
            </button>
          </div>
        )}
      </section>

      {analytics.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : analytics.isError || !analytics.data ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h2 className="font-bold text-red-900">No se pudo cargar la ficha</h2>
          <p className="mt-1 text-sm text-red-700">
            {getAdminErrorMessage(
              analytics.error,
              'Verifica la conexión e inténtalo nuevamente.',
            )}
          </p>
          <button
            type="button"
            onClick={() => void analytics.refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white"
          >
            <RefreshCw className="size-4" /> Reintentar
          </button>
        </section>
      ) : (
        <ClientAnalyticsContent
          data={analytics.data}
          page={page}
          onPageChange={selectPage}
        />
      )}
    </>
  )
}

function ClientAnalyticsContent({
  data,
  page,
  onPageChange,
}: {
  data: NonNullable<ReturnType<typeof useClientAnalytics>['data']>
  page: number
  onPageChange: (page: number) => void
}) {
  const selectedLabel =
    data.status === 'paid'
      ? 'pagadas'
      : data.status === 'pending'
        ? 'pendientes'
        : 'pagadas y pendientes'
  return (
    <>
      <section className="mb-5 flex flex-col gap-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-lg font-black text-brand-950">{data.client.name}</p>
          <p className="mt-1 text-sm text-brand-900/70">
            NIT/CI {data.client.tax_id} · {data.client.whatsapp} · {data.client.city_zone}
            , {data.client.department}
          </p>
          <p className="mt-1 text-xs text-brand-900/60">
            {data.client.business_activity}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand-700 shadow-sm">
            {data.client.client_type}
          </span>
          <span className="rounded-full bg-brand-700 px-3 py-1.5 text-xs font-bold text-white">
            Nivel {data.client.price_level.name}
          </span>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Compras pagadas"
          value={money(data.lifetime.paid.total)}
          detail={`${data.lifetime.paid.count} compras · ${data.lifetime.paid.quantity} unidades`}
          icon={CheckCircle2}
          color="emerald"
        />
        <MetricCard
          title="Cotizaciones pendientes"
          value={money(data.lifetime.pending.total)}
          detail={`${data.lifetime.pending.count} pendientes · ${data.lifetime.pending.quantity} unidades`}
          icon={Clock3}
          color="amber"
        />
        <MetricCard
          title={`Actividad ${selectedLabel}`}
          value={money(data.selected.total)}
          detail={`${data.selected.count} registros · ${data.selected.quantity} unidades`}
          icon={ReceiptText}
          color="brand"
        />
        <MetricCard
          title="Frecuencia"
          value={data.frequency.label}
          detail={
            data.frequency.average_days === null
              ? 'Aún no hay intervalos para calcular'
              : `Compra o cotiza cada ${data.frequency.average_days} días en promedio`
          }
          icon={Repeat2}
          color="slate"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Actividad por mes</h2>
          <p className="mt-1 text-sm text-slate-500">
            Montos de cotizaciones {selectedLabel} durante el periodo elegido.
          </p>
          <MonthlyChart values={data.monthly} />
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Última actividad</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <InfoRow
              label="Última compra pagada"
              value={formatDateTime(data.last_purchase_at)}
            />
            <InfoRow
              label="Última cotización"
              value={formatDateTime(data.last_activity_at)}
            />
            <InfoRow label="Rango comercial" value={data.client.price_level.name} />
            <InfoRow label="Categoría" value={data.client.client_type} />
          </dl>
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <PackageSearch className="size-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Productos más frecuentes</h2>
            <p className="text-xs text-slate-500">
              Cantidades y montos según los filtros actuales.
            </p>
          </div>
        </div>
        {data.top_products.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-3">Producto</th>
                  <th className="py-3 text-right">Operaciones</th>
                  <th className="py-3 text-right">Cantidad</th>
                  <th className="py-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {data.top_products.map((product) => (
                  <tr
                    key={`${product.product_id}-${product.sku}`}
                    className="border-b border-slate-100"
                  >
                    <td className="py-3">
                      <p className="font-bold text-slate-800">{product.name}</p>
                      <p className="font-mono text-xs text-slate-500">{product.sku}</p>
                    </td>
                    <td className="py-3 text-right">{product.quotation_count}</td>
                    <td className="py-3 text-right font-bold">{product.quantity}</td>
                    <td className="py-3 text-right font-bold text-brand-800">
                      {money(product.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
            No hay productos para los filtros seleccionados.
          </p>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold text-slate-900">
            Historial completo de compras y cotizaciones
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Se muestran 10 registros por página para mantener una consulta rápida.
          </p>
        </div>
        {data.history.results.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Número</th>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3 text-right">Productos</th>
                  <th className="px-5 py-3 text-right">Unidades</th>
                  <th className="px-5 py-3 text-right">Monto</th>
                  <th className="px-5 py-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {data.history.results.map((quotation) => (
                  <tr key={quotation.id} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-mono text-xs font-bold text-brand-700">
                      {quotation.number}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {formatDateOnly(quotation.quotation_date)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          quotation.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {quotation.status === 'paid' ? 'Pagada' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">{quotation.products_count}</td>
                    <td className="px-5 py-3 text-right">{quotation.quantity}</td>
                    <td className="px-5 py-3 text-right font-bold">
                      {money(quotation.total)}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        to={`/quotations/${quotation.id}`}
                        className="text-xs font-bold text-brand-700 hover:text-brand-900"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-6 text-center text-sm text-slate-500">
            No hay compras o cotizaciones para estos filtros.
          </p>
        )}
        {data.history.total_pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 p-4">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-sm text-slate-500">
              Página {data.history.page} de {data.history.total_pages}
            </span>
            <button
              type="button"
              disabled={page >= data.history.total_pages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        )}
      </section>
    </>
  )
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  detail: string
  icon: typeof ShoppingBag
  color: 'emerald' | 'amber' | 'brand' | 'slate'
}) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    brand: 'bg-brand-50 text-brand-700',
    slate: 'bg-slate-100 text-slate-700',
  }
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`grid size-10 place-items-center rounded-xl ${colors[color]}`}>
        <Icon className="size-5" />
      </div>
      <p className="mt-4 text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </section>
  )
}

function MonthlyChart({
  values,
}: {
  values: Array<{ month: string; label: string; total: string }>
}) {
  const maximum = Math.max(...values.map((item) => Number(item.total)), 0)
  return values.length ? (
    <div className="mt-5 overflow-x-auto pb-2">
      <div className="flex h-52 min-w-max items-end gap-3 border-b border-slate-200 px-1">
        {values.map((item) => (
          <div
            key={item.month}
            className="flex h-full w-12 flex-col justify-end text-center"
          >
            <span className="mb-1 text-[10px] font-bold text-slate-500">
              {money(item.total)}
            </span>
            <div
              title={`${item.label}: ${money(item.total)}`}
              className="mx-auto w-8 rounded-t-lg bg-brand-500 transition hover:bg-brand-700"
              style={{
                height: `${maximum ? Math.max(5, (Number(item.total) / maximum) * 82) : 3}%`,
              }}
            />
            <span className="mt-2 text-[10px] text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  ) : (
    <p className="mt-5 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
      No hay actividad mensual para los filtros seleccionados.
    </p>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-bold text-slate-800">{value}</dd>
    </div>
  )
}

function formatDateTime(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString('es-BO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'Sin registros'
}

function formatDateOnly(value: string | null) {
  return value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('es-BO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'Sin registros'
}
