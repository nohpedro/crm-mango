import { FileSpreadsheet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../../store/authStore'
import { hasAnyPermission } from '../../../utils/permissions'

export function QuotationTransferLink({ filters = '' }: { filters?: string }) {
  const user = useAuthStore((state) => state.user)
  if (
    !hasAnyPermission(user, [
      'quotations.import_quotation',
      'quotations.export_quotation',
    ])
  )
    return null
  return (
    <Link
      to={`/quotations/import-export${filters ? `?${filters}` : ''}`}
      className="inline-flex items-center gap-2 rounded-xl border border-brand-200 px-4 py-3 text-sm font-bold text-brand-700"
    >
      <FileSpreadsheet className="size-4" /> Importar / Exportar
    </Link>
  )
}
