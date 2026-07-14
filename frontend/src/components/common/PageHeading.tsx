import type { ReactNode } from 'react'

interface PageHeadingProps {
  title: string
  description: string
  action?: ReactNode
}

export function PageHeading({ title, description, action }: PageHeadingProps) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-brand-600">
          CRM IDESEM
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  )
}
