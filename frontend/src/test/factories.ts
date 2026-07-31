import type { User } from '../modules/auth/types/auth.types'

export const adminUser: User = {
  id: 'a8a949a3-fc85-4682-9d73-da65555c4120',
  username: 'administrador',
  email: 'admin@idesem.com',
  first_name: 'Admin',
  last_name: 'IDESEM',
  full_name: 'Admin IDESEM',
  is_active: true,
  is_staff: true,
  is_admin: true,
  permissions: ['*'],
  role: {
    id: '2f223d83-076d-401b-935e-d98600ce2385',
    name: 'Administrador',
    code: 'ADMIN',
  },
  last_login: null,
  created_at: '2026-07-13T00:00:00Z',
  updated_at: '2026-07-13T00:00:00Z',
}
