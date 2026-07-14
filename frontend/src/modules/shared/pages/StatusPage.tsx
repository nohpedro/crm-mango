import { ArrowLeft, CircleAlert, ShieldX } from 'lucide-react'
import { Link } from 'react-router-dom'

interface StatusPageProps {
  code: string
  title: string
  description: string
  unauthorized?: boolean
}

export function StatusPage({
  code,
  title,
  description,
  unauthorized = false,
}: StatusPageProps) {
  const Icon = unauthorized ? ShieldX : CircleAlert
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center">
      <div className="max-w-lg">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Icon className="size-7" />
        </div>
        <p className="mt-6 text-sm font-bold tracking-[0.2em] text-brand-600">
          ERROR {code}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
        <Link
          to="/dashboard"
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700"
        >
          <ArrowLeft className="size-4" /> Volver al panel
        </Link>
      </div>
    </main>
  )
}
