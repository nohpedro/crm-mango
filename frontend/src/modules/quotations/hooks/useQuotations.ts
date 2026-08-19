import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { quotationService } from '../services/quotation.service'
import type {
  QuotationStatus,
  QuotationTemplateWriteRequest,
  QuotationWriteRequest,
} from '../types/quotation.types'

export function useQuotations(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ['quotations', params],
    queryFn: () => quotationService.list(params),
  })
}

export function useQuotation(id: string | undefined) {
  return useQuery({
    queryKey: ['quotation', id],
    queryFn: () => quotationService.get(id ?? ''),
    enabled: Boolean(id),
  })
}

export function useQuotationTemplates(enabled = true) {
  return useQuery({
    queryKey: ['quotation-templates'],
    queryFn: quotationService.listTemplates,
    enabled,
  })
}

export function useQuotationTemplateMutations() {
  const client = useQueryClient()
  const invalidate = () =>
    void client.invalidateQueries({ queryKey: ['quotation-templates'] })
  return {
    create: useMutation({
      mutationFn: quotationService.createTemplate,
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        payload,
      }: {
        id: number
        payload: Partial<QuotationTemplateWriteRequest>
      }) => quotationService.updateTemplate(id, payload),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: quotationService.deleteTemplate,
      onSuccess: invalidate,
    }),
    uploadImage: useMutation({
      mutationFn: ({
        template,
        image,
        altText,
      }: {
        template: number
        image: File
        altText?: string
      }) => quotationService.uploadTemplateImage(template, image, altText),
      onSuccess: invalidate,
    }),
    removeImage: useMutation({
      mutationFn: quotationService.deleteTemplateImage,
      onSuccess: invalidate,
    }),
  }
}

export function useQuotationMutations() {
  const client = useQueryClient()
  const invalidate = (id?: string) => {
    void client.invalidateQueries({ queryKey: ['quotations'] })
    void client.invalidateQueries({ queryKey: ['dashboard'] })
    void client.invalidateQueries({ queryKey: ['client-analytics'] })
    if (id) void client.invalidateQueries({ queryKey: ['quotation', id] })
  }
  return {
    create: useMutation({
      mutationFn: quotationService.create,
      onSuccess: () => invalidate(),
    }),
    update: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: QuotationWriteRequest }) =>
        quotationService.update(id, payload),
      onSuccess: (_, values) => invalidate(values.id),
    }),
    updateStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: QuotationStatus }) =>
        quotationService.updateStatus(id, status),
      onSuccess: (_, values) => invalidate(values.id),
    }),
  }
}
