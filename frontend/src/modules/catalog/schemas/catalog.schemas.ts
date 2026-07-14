import { z } from 'zod'

export const catalogWriteSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200),
  code: z.string().trim().min(1, 'El código es obligatorio.').max(40),
  description: z.string().trim().max(2000),
  is_active: z.boolean(),
})
export const productSchema = z.object({
  category: z.string().uuid('Selecciona una categoría válida.'),
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200),
  sku: z.string().trim().min(1, 'El SKU es obligatorio.').max(80),
  barcode: z.string().trim().max(100).nullable(),
  description: z.string().trim().max(5000),
  is_active: z.boolean(),
})
export type CatalogWriteValues = z.infer<typeof catalogWriteSchema>
export type ProductFormValues = z.infer<typeof productSchema>
