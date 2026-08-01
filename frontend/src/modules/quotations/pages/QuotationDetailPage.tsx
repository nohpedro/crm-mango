import { ArrowLeft, Download, Pencil, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import logo from '../../../assets/IDESEM_sin_fondo.png'
import { PageHeading } from '../../../components/common/PageHeading'
import { useAuthStore } from '../../../store/authStore'
import { hasPermission } from '../../../utils/permissions'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import { quotationService } from '../services/quotation.service'
import { useQuotation } from '../hooks/useQuotations'
import type { PaperFormat } from '../types/quotation.types'

export function QuotationDetailPage() {
  const { id } = useParams()
  const user = useAuthStore((state) => state.user)
  const canEdit = hasPermission(user, 'quotations.change_quotation')
  const query = useQuotation(id)
  const quotation = query.data
  const getPdf = (paper: PaperFormat, print = false) =>
    void quotationService
      .downloadPdf(id ?? '', paper)
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        if (print) window.open(url, '_blank', 'noopener,noreferrer')
        else {
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = `${quotation?.number ?? 'cotizacion'}-${paper}.pdf`
          anchor.click()
        }
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      })
      .catch((error: unknown) =>
        toast.error(getAdminErrorMessage(error, 'No se pudo generar el PDF.')),
      )
  if (query.isLoading)
    return <p className="text-sm text-slate-500">Cargando cotización…</p>
  if (!quotation)
    return (
      <p className="text-sm text-red-600">No se encontró la cotización solicitada.</p>
    )
  return (
    <>
      <PageHeading
        title={quotation.number}
        description={`Cotización para ${quotation.client_name}. Revisa el documento o elige el tamaño de papel antes de compartirlo.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/quotations/history"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700"
            >
              <ArrowLeft className="size-4" /> Historial
            </Link>
            {canEdit && (
              <Link
                to={`/quotations/${id}/edit`}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-200 px-3 py-2.5 text-sm font-bold text-brand-700"
              >
                <Pencil className="size-4" /> Editar
              </Link>
            )}
          </div>
        }
      />
      <section className="mb-5 rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
        <h3 className="text-sm font-bold text-brand-900">Lista para entregar</h3>
        <p className="mt-1 text-sm text-brand-900/75">
          Descarga el PDF para enviarlo. Para imprimir, abre el documento y usa la opción
          de impresión de tu navegador.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => getPdf('standard')}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white"
          >
            <Download className="size-4" /> PDF hoja estándar
          </button>
          <button
            type="button"
            onClick={() => getPdf('roll')}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white"
          >
            <Download className="size-4" /> PDF papel rollo
          </button>
          <button
            type="button"
            onClick={() => getPdf('standard', true)}
            className="inline-flex items-center gap-2 rounded-xl border border-brand-200 px-4 py-2.5 text-sm font-bold text-brand-700"
          >
            <Printer className="size-4" /> Abrir para imprimir
          </button>
        </div>
      </section>
      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <header className="flex items-start justify-between border-b border-slate-200 pb-6">
          <img
            src={logo}
            alt="IDESEM"
            className="h-14 max-w-40 object-contain object-left"
          />
          <div className="text-right">
            <h2 className="text-xl font-bold text-brand-900">COTIZACIÓN</h2>
            <p className="mt-1 font-mono text-sm text-slate-600">{quotation.number}</p>
          </div>
        </header>
        <section className="grid gap-4 border-b border-slate-100 py-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Cliente
            </p>
            <p className="mt-1 font-bold text-slate-900">{quotation.client_name}</p>
            <p className="text-sm text-slate-600">
              {quotation.client_tax_id && `NIT/CI: ${quotation.client_tax_id}`}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm text-slate-600">
              Tel. {quotation.client_phone || 'No registrado'}
            </p>
            <p className="text-sm text-slate-600">
              Válida por {quotation.valid_days} días
            </p>
          </div>
        </section>
        <div className="overflow-x-auto py-5">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="pb-3">Producto</th>
                <th className="pb-3 text-right">Cantidad</th>
                <th className="pb-3 text-right">P. unitario</th>
                <th className="pb-3 text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-3">
                    <p className="font-semibold text-slate-800">{item.name}</p>
                    <p className="font-mono text-xs text-slate-500">{item.sku}</p>
                  </td>
                  <td className="py-3 text-right">{item.quantity}</td>
                  <td className="py-3 text-right">
                    Bs {Number(item.unit_price).toFixed(2)}
                  </td>
                  <td className="py-3 text-right font-semibold">
                    Bs {Number(item.total).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:justify-between">
          <p className="max-w-xl text-sm text-slate-600">
            {quotation.notes || 'Gracias por su preferencia.'}
          </p>
          <p className="text-xl font-bold text-brand-900">
            Total: Bs {Number(quotation.total).toFixed(2)}
          </p>
        </footer>
      </article>
    </>
  )
}
