import { z } from 'zod'

const optionalTrimmedText = z.string().trim()

export const userSchema = z.object({
  username: z.string().trim().min(1, 'El nombre de usuario es obligatorio.').max(150),
  email: z.string().trim().toLowerCase().email('Ingresa un correo válido.'),
  first_name: optionalTrimmedText.max(150),
  last_name: optionalTrimmedText.max(150),
  password: z.string().optional(),
  role: z.string().nullable(),
  is_active: z.boolean(),
})

export const roleSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(100),
  code: z.string().trim().min(1, 'El código es obligatorio.').max(50),
  description: optionalTrimmedText,
  permissions: z.array(z.number()),
  is_active: z.boolean(),
})

export type UserFormValues = z.infer<typeof userSchema>
export type RoleFormValues = z.infer<typeof roleSchema>
