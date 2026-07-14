import { ArrowRight, Construction } from 'lucide-react'

import { PageHeading } from '../../../components/common/PageHeading'

interface ModulePlaceholderPageProps {
  title: string
  description: string
}

export function ModulePlaceholderPage({
  title,
  description,
}: ModulePlaceholderPageProps) {
  return (
    <>
      <PageHeading title={title} description={description} />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="h-2.5 w-40 rounded-full bg-slate-200" />
        </div>
        <div className="grid min-h-72 place-items-center p-8 text-center">
          <div>
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <Construction className="size-6" />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">Estructura preparada</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              La interfaz, consultas y formularios de este módulo se incorporarán en su
              fase correspondiente.
            </p>
            <span className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand-600">
              Contrato de ruta activo <ArrowRight className="size-3.5" />
            </span>
          </div>
        </div>
      </section>
    </>
  )
}
