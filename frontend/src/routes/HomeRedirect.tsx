import { Navigate } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { hasAnyPermission } from '../utils/permissions'

const destinations = [
  { path: '/dashboard', permissions: ['quotations.view_dashboard'] },
  { path: '/clients', permissions: ['clients.view_client'] },
  { path: '/quotations', permissions: ['quotations.add_quotation'] },
  { path: '/quotations/history', permissions: ['quotations.view_quotation'] },
  { path: '/products', permissions: ['products.view_product'] },
  { path: '/inventory', permissions: ['inventory.view_stock'] },
  {
    path: '/quotations/templates',
    permissions: ['quotations.manage_quotation_templates'],
  },
  { path: '/users', permissions: ['users.view_user'] },
  { path: '/roles', permissions: ['users.view_role'] },
]

export function HomeRedirect() {
  const user = useAuthStore((state) => state.user)
  const destination = destinations.find((item) =>
    hasAnyPermission(user, item.permissions),
  )
  return <Navigate to={destination?.path ?? '/unauthorized'} replace />
}
