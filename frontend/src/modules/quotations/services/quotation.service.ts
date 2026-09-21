import { requestHandler } from '../../auth/services/auth.service'
import type {
  Quotation,
  QuotationWriteRequest,
  PaginatedQuotations,
  PaperFormat,
  QuotationTemplate,
  QuotationTemplateImage,
  QuotationTemplateWriteRequest,
  QuotationStatus,
} from '../types/quotation.types'

export const quotationService = {
  list: (params: Record<string, string | number | undefined>) =>
    requestHandler.get<PaginatedQuotations>('quotations/', { params }),
  get: (id: string) => requestHandler.get<Quotation>(`quotations/${id}/`),
  create: (payload: QuotationWriteRequest) =>
    requestHandler.post<Quotation, QuotationWriteRequest>('quotations/', payload),
  update: (id: string, payload: QuotationWriteRequest) =>
    requestHandler.put<Quotation, QuotationWriteRequest>(`quotations/${id}/`, payload),
  updateStatus: (id: string, status: QuotationStatus) =>
    requestHandler.patch<Quotation, { status: QuotationStatus }>(`quotations/${id}/`, {
      status,
    }),
  downloadPdf: (id: string, paper: PaperFormat) =>
    requestHandler.download(`quotations/${id}/pdf/`, { params: { paper } }),
  markPaid: (
    id: string,
    items: Array<{ id: number; serial_numbers: string[]; manual_unit_price?: number }>,
  ) =>
    requestHandler.post<Quotation, { items: typeof items }>(
      `quotations/${id}/mark-paid/`,
      { items },
    ),
  listTemplates: () => requestHandler.get<QuotationTemplate[]>('quotations/templates/'),
  createTemplate: (payload: QuotationTemplateWriteRequest) =>
    requestHandler.post<QuotationTemplate, QuotationTemplateWriteRequest>(
      'quotations/templates/',
      payload,
    ),
  updateTemplate: (id: number, payload: Partial<QuotationTemplateWriteRequest>) =>
    requestHandler.patch<QuotationTemplate, Partial<QuotationTemplateWriteRequest>>(
      `quotations/templates/${id}/`,
      payload,
    ),
  deleteTemplate: (id: number) =>
    requestHandler.delete<void>(`quotations/templates/${id}/`),
  uploadTemplateImage: (template: number, image: File, altText = '') =>
    requestHandler.postMultipart<QuotationTemplateImage>('quotations/template-images/', {
      fields: { template, alt_text: altText },
      files: { image },
    }),
  deleteTemplateImage: (id: number) =>
    requestHandler.delete<void>(`quotations/template-images/${id}/`),
}
