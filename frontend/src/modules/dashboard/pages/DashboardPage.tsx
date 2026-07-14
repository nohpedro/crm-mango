import { Boxes, PackageSearch, ShieldCheck, Warehouse } from 'lucide-react'

import { PageHeading } from '../../../components/common/PageHeading'

const cards = [
  {
    label: 'Productos',
    value: '—',
    detail: 'Catálogo comercial',
    icon: PackageSearch,
    tone: 'bg-blue-50 text-blue-700',
  },
  {
    label: 'Existencias',
    value: '—',
    detail: 'Stock por almacén',
    icon: Boxes,
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    label: 'Almacenes',
    value: '—',
    detail: 'Ubicaciones registradas',
    icon: Warehouse,
    tone: 'bg-amber-50 text-amber-700',
  },
  {
    label: 'Administración',
    value: '—',
    detail: 'Usuarios y roles',
    icon: ShieldCheck,
    tone: 'bg-violet-50 text-violet-700',
  },
]

export function DashboardPage() {
  return (
    <>
      <PageHeading
        title="Panel principal"
        description="Vista general de catálogo, existencias y administración del CRM."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, detail, icon: Icon, tone }) => (
          <article
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                  {value}
                </p>
                <p className="mt-1 text-xs text-slate-400">{detail}</p>
              </div>
              <div className={`grid size-11 place-items-center rounded-xl ${tone}`}>
                <Icon className="size-5" />
              </div>
            </div>
          </article>
        ))}
      </div>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-semibold text-slate-900">Actividad del sistema</h3>
            <p className="mt-1 text-sm text-slate-500">
              Los datos se conectarán a la API en las siguientes fases.
            </p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            Base lista
          </span>
        </div>
        <div className="grid min-h-56 place-items-center text-sm text-slate-400">
          Sin actividad disponible todavía
        </div>
      </section>
    </>
  )
}
