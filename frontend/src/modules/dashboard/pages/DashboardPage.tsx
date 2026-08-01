import {
  CalendarRange,
  CalendarDays,
  FileSpreadsheet,
  FileText,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  UsersRound,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeading } from '../../../components/common/PageHeading'
import { useAuthStore } from '../../../store/authStore'
import { hasPermission } from '../../../utils/permissions'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { useDashboard } from '../hooks/useDashboard'
import { dashboardService } from '../services/dashboard.service'
import type {
  DashboardPeriod,
  DashboardRange,
  DashboardSeriesItem,
  DashboardStatus,
  SalesSummary,
  StandardDashboardPeriod,
} from '../types/dashboard.types'

const periods: Array<{
  key: StandardDashboardPeriod
  label: string
  cardLabel: string
}> = [
  { key: 'day', label: 'Hoy', cardLabel: 'Ventas de hoy' },
  { key: 'week', label: 'Esta semana', cardLabel: 'Ventas de la semana' },
  { key: 'month', label: 'Este mes', cardLabel: 'Ventas del mes' },
]

const money = (value: string | number) =>
  `Bs ${Number(value).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const quotationCount = (count: number) =>
  `${count} ${count === 1 ? 'cotización' : 'cotizaciones'}`

const localIsoDate = (value = new Date()) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const initialRange = (): Required<DashboardRange> => {
  const today = new Date()
  return {
    start_date: localIsoDate(
      new Date(today.getFullYear(), today.getMonth(), 1),
    ),
    end_date: localIsoDate(today),
  }
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const canViewReports = hasPermission(user, 'quotations.view_quotation')
  const [period, setPeriod] = useState<DashboardPeriod>('month')
  const [statusFilter, setStatusFilter] = useState<DashboardStatus>('all')
  const [rangeDraft, setRangeDraft] = useState(initialRange)
  const [appliedRange, setAppliedRange] = useState(initialRange)
  const [downloading, setDownloading] = useState<'pdf' | 'csv' | null>(null)
  const report = useDashboard(period, appliedRange, statusFilter, canViewReports)

  const applyCustomRange = () => {
    const start = new Date(`${rangeDraft.start_date}T00:00:00`)
    const end = new Date(`${rangeDraft.end_date}T00:00:00`)
    if (!rangeDraft.start_date || !rangeDraft.end_date) {
      toast.error('Selecciona una fecha inicial y una fecha final.')
      return
    }
    if (start > end) {
      toast.error('La fecha inicial no puede ser posterior a la fecha final.')
      return
    }
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000)
    if (days > 366) {
      toast.error('El rango personalizado no puede superar 366 días.')
      return
    }
    setAppliedRange(rangeDraft)
    setPeriod('custom')
  }

  const downloadReport = async (format: 'pdf' | 'csv') => {
    setDownloading(format)
    try {
      const blob =
        format === 'pdf'
          ? await dashboardService.downloadPdf(period, appliedRange, statusFilter)
          : await dashboardService.downloadCsv(period, appliedRange, statusFilter)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download =
        format === 'pdf'
          ? `reporte-ventas-${reportName(period, appliedRange)}.pdf`
          : `datos-ventas-${reportName(period, appliedRange)}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success(
        format === 'pdf'
          ? 'Reporte PDF descargado.'
          : 'Datos CSV descargados.',
      )
    } catch (error) {
      toast.error(
        getAdminErrorMessage(error, 'No se pudo descargar el reporte.'),
      )
    } finally {
      setDownloading(null)
    }
  }

  if (!canViewReports) {
    return (
      <>
        <PageHeading
          title="Panel principal"
          description="Resumen comercial del sistema."
        />
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-bold text-amber-900">
            Reportes comerciales no disponibles
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-amber-800">
            Tu rol no tiene permiso para consultar cotizaciones. Un administrador
            puede habilitar el permiso “Ver cotizaciones” para mostrar estas
            métricas.
          </p>
        </section>
      </>
    )
  }

  return (
    <>
      <PageHeading
        title="Panel principal"
        description="Consulta rápidamente las ventas cotizadas, los productos más solicitados y tus clientes principales."
        action={
          <Link
            to="/quotations/history"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ReceiptText className="size-4" />
            Ver cotizaciones
          </Link>
        }
      />

      <section className="mb-5 flex flex-col gap-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-bold text-brand-900">¿Qué información se muestra?</p>
          <p className="mt-1 text-sm text-brand-800">
            Filtra las cotizaciones por estado y periodo. El mismo filtro se
            aplicará al panel, al reporte PDF y a los datos CSV.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(downloading)}
            onClick={() => void downloadReport('pdf')}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {downloading === 'pdf' ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            Generar reporte PDF
          </button>
          <button
            type="button"
            disabled={Boolean(downloading)}
            onClick={() => void downloadReport('csv')}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 disabled:opacity-50"
          >
            {downloading === 'csv' ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            Descargar datos CSV
          </button>
        </div>
      </section>

      <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <span className="text-sm font-bold text-slate-700">Estado:</span>
        {([
          ['all', 'Todas'],
          ['pending', 'Pendientes'],
          ['paid', 'Pagadas'],
        ] as Array<[DashboardStatus, string]>).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              statusFilter === key
                ? key === 'paid'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : key === 'pending'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-brand-700 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="text-xs text-slate-500 sm:ml-auto">
          Mostrando:{' '}
          {statusFilter === 'all'
            ? 'todos los estados'
            : statusFilter === 'paid'
              ? 'solo pagadas'
              : 'solo pendientes'}
        </span>
      </section>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-2 text-sm font-bold text-slate-700">
          <CalendarDays className="size-4" />
          Periodo del reporte:
        </span>
        {periods.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPeriod(item.key)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              period === item.key
                ? 'bg-brand-700 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPeriod('custom')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            period === 'custom'
              ? 'bg-brand-700 text-white shadow-sm'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <CalendarRange className="size-4" />
          Elegir fechas
        </button>
      </div>

      {period === 'custom' && (
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <label className="flex-1 text-sm font-bold text-slate-700">
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
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="flex-1 text-sm font-bold text-slate-700">
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
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <button
              type="button"
              onClick={applyCustomRange}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-800"
            >
              <CalendarDays className="size-4" />
              Mostrar este rango
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Puedes consultar hasta 366 días. El mismo rango se aplicará al
            panel, al reporte PDF y a los datos CSV.
          </p>
        </section>
      )}

      {report.isLoading ? (
        <DashboardLoading />
      ) : report.isError || !report.data ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h2 className="font-bold text-red-900">No se pudo cargar el panel</h2>
          <p className="mt-1 text-sm text-red-700">
            {getAdminErrorMessage(
              report.error,
              'Verifica la conexión con el servidor e inténtalo nuevamente.',
            )}
          </p>
          <button
            type="button"
            onClick={() => void report.refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white"
          >
            <RefreshCw className="size-4" /> Reintentar
          </button>
        </section>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {periods.map((item) => (
              <SalesCard
                key={item.key}
                label={item.cardLabel}
                summary={report.data.sales[item.key]}
                active={period === item.key}
                onClick={() => setPeriod(item.key)}
              />
            ))}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">
                    Cotizaciones de {report.data.period.label.toLowerCase()}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Evolución diaria según el estado seleccionado.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-900">
                    {money(report.data.selected.total)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {quotationCount(report.data.selected.count)}
                  </p>
                </div>
              </div>
              <SalesChart values={report.data.series} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <ShoppingBag className="size-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Promedio por cotización</p>
                  <p className="text-xl font-black text-slate-900">
                    {money(report.data.selected.average)}
                  </p>
                </div>
              </div>
              <dl className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Desde</dt>
                  <dd className="font-bold text-slate-800">
                    {formatDate(report.data.period.start)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Hasta</dt>
                  <dd className="font-bold text-slate-800">
                    {formatDate(report.data.period.end)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Actualizado</dt>
                  <dd className="font-bold text-slate-800">
                    {new Date(report.data.generated_at).toLocaleTimeString(
                      'es-BO',
                      { hour: '2-digit', minute: '2-digit' },
                    )}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Ranking
              title="Productos más cotizados"
              description="Ordenados por la cantidad total solicitada."
              icon={ShoppingBag}
              empty="Todavía no hay productos cotizados en este periodo."
              rows={report.data.top_products.map((item) => ({
                key: item.product_id ?? `${item.sku}-${item.name}`,
                title: item.name,
                subtitle: `${item.sku || 'Sin SKU'} · ${quotationCount(item.quotation_count)}`,
                value: `${item.quantity} unidades`,
                total: money(item.total),
              }))}
            />
            <Ranking
              title="Clientes con más cotizaciones"
              description="Clientes con mayor actividad durante el periodo."
              icon={UsersRound}
              empty="Todavía no hay clientes con cotizaciones para este filtro."
              rows={report.data.top_clients.map((item) => ({
                key: item.client_id ?? `${item.client_tax_id}-${item.client_name}`,
                title: item.client_name,
                subtitle: `${item.client_tax_id || 'Sin NIT/CI'} · ${money(item.total)}`,
                value: quotationCount(item.quotation_count),
              }))}
            />
          </div>
        </>
      )}
    </>
  )
}

function SalesCard({
  label,
  summary,
  active,
  onClick,
}: {
  label: string
  summary: SalesSummary
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 ${
        active
          ? 'border-brand-300 bg-brand-50 ring-2 ring-brand-100'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">
            {money(summary.total)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {quotationCount(summary.count)}
          </p>
        </div>
        <div
          className={`grid size-10 place-items-center rounded-xl ${
            active
              ? 'bg-brand-700 text-white'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          <ReceiptText className="size-5" />
        </div>
      </div>
    </button>
  )
}

function SalesChart({ values }: { values: DashboardSeriesItem[] }) {
  const max = Math.max(...values.map((item) => Number(item.total)), 0)
  const hasSales = max > 0
  const labelStep = values.length > 14 ? 5 : values.length > 8 ? 2 : 1
  return (
    <div className="mt-6 overflow-x-auto pb-2">
      <div
        style={{
          minWidth: values.length > 31 ? `${values.length * 18}px` : undefined,
        }}
      >
        <div
          className="grid h-56 items-end gap-1.5 border-b border-slate-200"
          style={{
            gridTemplateColumns: `repeat(${Math.max(values.length, 1)}, minmax(12px, 1fr))`,
          }}
        >
          {values.map((item) => {
            const height = max ? Math.max(4, (Number(item.total) / max) * 100) : 2
            return (
              <div
                key={item.date}
                className="group relative flex h-full items-end"
                title={`${item.label}: ${money(item.total)} · ${quotationCount(item.count)}`}
              >
                <div
                  className={`w-full rounded-t-md transition-all ${
                    hasSales
                      ? 'bg-brand-500 group-hover:bg-brand-700'
                      : 'bg-slate-100'
                  }`}
                  style={{ height: `${height}%` }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold text-white shadow-lg group-hover:block">
                  {money(item.total)}
                </div>
              </div>
            )
          })}
        </div>
        <div
          className="mt-2 grid gap-1.5 text-center text-[10px] text-slate-400"
          style={{
            gridTemplateColumns: `repeat(${Math.max(values.length, 1)}, minmax(12px, 1fr))`,
          }}
        >
          {values.map((item, index) => (
            <span key={item.date}>
              {index % labelStep === 0 || index === values.length - 1
                ? item.label
                : ''}
            </span>
          ))}
        </div>
      </div>
      {!hasSales && (
        <p className="mt-4 text-center text-sm text-slate-500">
          No hay cotizaciones para este periodo y estado.
        </p>
      )}
    </div>
  )
}

function Ranking({
  title,
  description,
  icon: Icon,
  rows,
  empty,
}: {
  title: string
  description: string
  icon: typeof ShoppingBag
  rows: Array<{
    key: string | number
    title: string
    subtitle: string
    value: string
    total?: string
  }>
  empty: string
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <Icon className="size-5" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      {rows.length ? (
        <ol className="mt-4 divide-y divide-slate-100">
          {rows.map((row, index) => (
            <li key={row.key} className="flex items-center gap-3 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-600">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">
                  {row.title}
                </p>
                <p className="truncate text-xs text-slate-500">{row.subtitle}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-black text-brand-800">{row.value}</p>
                {row.total && (
                  <p className="text-xs text-slate-500">{row.total}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-5 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
          {empty}
        </div>
      )}
    </section>
  )
}

function DashboardLoading() {
  return (
    <div className="space-y-5" aria-label="Cargando panel">
      <div className="grid gap-4 lg:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-32 animate-pulse rounded-2xl bg-slate-100"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  )
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function reportName(period: DashboardPeriod, range: DashboardRange) {
  return period === 'custom'
    ? `${range.start_date}-${range.end_date}`
    : period
}
