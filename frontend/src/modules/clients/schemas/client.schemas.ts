import { z } from 'zod'

export const clientSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200),
  tax_id: z.string().trim().min(1, 'El NIT/CI es obligatorio.').max(30),
  department: z.string().trim().min(1, 'El departamento es obligatorio.').max(80),
  city_zone: z.string().trim().min(1, 'La ciudad/zona es obligatoria.').max(120),
  whatsapp: z.string().trim().min(1, 'El WhatsApp es obligatorio.').max(30),
  client_type: z.string().min(1, 'Selecciona un tipo de cliente.'),
  price_level: z.string().uuid('Selecciona un nivel de precio.'),
  business_activity: z.string().trim().min(1, 'El rubro es obligatorio.').max(200),
  observations: z.string().trim().max(2000),
  is_active: z.boolean(),
})

export type ClientFormValues = z.infer<typeof clientSchema>
