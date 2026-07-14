import { LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

interface AdminFormActionsProps {
  pending: boolean
  cancelTo: string
  label: string
}

export function AdminFormActions({ pending, cancelTo, label }: AdminFormActionsProps) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
      <Link
        to={cancelTo}
        className="rounded-xl border border-slate-300 px-5 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Cancelar
      </Link>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && <LoaderCircle className="size-4 animate-spin" />}
        {pending ? 'Guardando…' : label}
      </button>
    </div>
  )
}
