import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'

import { AppLayout } from '../components/layout/AppLayout'
import { RoleFormPage } from '../modules/admin/pages/RoleFormPage'
import { RolesPage } from '../modules/admin/pages/RolesPage'
import { UserFormPage } from '../modules/admin/pages/UserFormPage'
import { UsersPage } from '../modules/admin/pages/UsersPage'
import { LoginPage } from '../modules/auth/pages/LoginPage'
import { DashboardPage } from '../modules/dashboard/pages/DashboardPage'
import { ModulePlaceholderPage } from '../modules/shared/pages/ModulePlaceholderPage'
import { StatusPage } from '../modules/shared/pages/StatusPage'
import { AdminRoute } from './AdminRoute'
import { ProtectedRoute } from './ProtectedRoute'
import { PublicOnlyRoute } from './PublicOnlyRoute'

const placeholder = (title: string, description: string) => (
  <ModulePlaceholderPage title={title} description={description} />
)

const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    path: '/unauthorized',
    element: (
      <StatusPage
        code="403"
        title="Acceso no autorizado"
        description="No tienes permisos suficientes para consultar esta sección."
        unauthorized
      />
    ),
  },
  {
    path: '/error',
    element: (
      <StatusPage
        code="500"
        title="Algo salió mal"
        description="Ocurrió un error inesperado. Intenta nuevamente en unos minutos."
      />
    ),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          {
            path: 'products',
            element: placeholder(
              'Productos',
              'Consulta y administración del catálogo comercial.',
            ),
          },
          {
            path: 'products/:id',
            element: placeholder(
              'Detalle de producto',
              'Información, inventario y precios del producto.',
            ),
          },
          {
            path: 'categories',
            element: placeholder('Categorías', 'Organización del catálogo de productos.'),
          },
          {
            path: 'price-levels',
            element: placeholder(
              'Niveles de precio',
              'Configuración de niveles comerciales.',
            ),
          },
          {
            path: 'inventory',
            element: placeholder(
              'Existencias',
              'Stock físico, reservado y disponible por almacén.',
            ),
          },
          {
            path: 'inventory/warehouses',
            element: placeholder('Almacenes', 'Ubicaciones físicas del inventario.'),
          },
          {
            path: 'inventory/movements',
            element: placeholder(
              'Movimientos',
              'Historial de entradas, salidas y ajustes.',
            ),
          },
          {
            element: <AdminRoute />,
            children: [
              { path: 'users', element: <UsersPage /> },
              { path: 'users/new', element: <UserFormPage /> },
              { path: 'users/:id/edit', element: <UserFormPage /> },
              { path: 'roles', element: <RolesPage /> },
              { path: 'roles/new', element: <RoleFormPage /> },
              { path: 'roles/:id/edit', element: <RoleFormPage /> },
              {
                path: 'products/new',
                element: placeholder(
                  'Nuevo producto',
                  'Registro de información comercial del producto.',
                ),
              },
              {
                path: 'products/:id/edit',
                element: placeholder(
                  'Editar producto',
                  'Actualización de la información del producto.',
                ),
              },
              {
                path: 'products/:id/prices',
                element: placeholder(
                  'Precios del producto',
                  'Escalas por nivel y cantidad mínima.',
                ),
              },
              {
                path: 'products/:id/images',
                element: placeholder(
                  'Imágenes del producto',
                  'Galería e imagen principal del producto.',
                ),
              },
              {
                path: 'categories/new',
                element: placeholder(
                  'Nueva categoría',
                  'Registro de una categoría comercial.',
                ),
              },
              {
                path: 'categories/:id/edit',
                element: placeholder(
                  'Editar categoría',
                  'Actualización de una categoría comercial.',
                ),
              },
              {
                path: 'price-levels/new',
                element: placeholder(
                  'Nuevo nivel de precio',
                  'Registro de un nivel comercial.',
                ),
              },
              {
                path: 'price-levels/:id/edit',
                element: placeholder(
                  'Editar nivel de precio',
                  'Actualización del nivel comercial.',
                ),
              },
              {
                path: 'inventory/:id/edit',
                element: placeholder(
                  'Stock mínimo',
                  'Actualización del umbral mínimo de existencia.',
                ),
              },
              {
                path: 'inventory/warehouses/new',
                element: placeholder(
                  'Nuevo almacén',
                  'Registro de una ubicación de inventario.',
                ),
              },
              {
                path: 'inventory/warehouses/:id/edit',
                element: placeholder(
                  'Editar almacén',
                  'Actualización de la ubicación de inventario.',
                ),
              },
              {
                path: 'inventory/movements/new',
                element: placeholder(
                  'Nuevo movimiento',
                  'Registro controlado de una variación de inventario.',
                ),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: (
      <StatusPage
        code="404"
        title="Página no encontrada"
        description="La dirección solicitada no existe o fue movida."
      />
    ),
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
