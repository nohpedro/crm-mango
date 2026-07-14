import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'

import { AppLayout } from '../components/layout/AppLayout'
import { RoleFormPage } from '../modules/admin/pages/RoleFormPage'
import { RolesPage } from '../modules/admin/pages/RolesPage'
import { UserFormPage } from '../modules/admin/pages/UserFormPage'
import { UsersPage } from '../modules/admin/pages/UsersPage'
import { ProductDetailPage } from '../modules/catalog/pages/ProductDetailPage'
import { ProductFormPage } from '../modules/catalog/pages/ProductFormPage'
import { ProductImagesPage } from '../modules/catalog/pages/ProductImagesPage'
import { ProductsPage } from '../modules/catalog/pages/ProductsPage'
import { ReferenceFormPage } from '../modules/catalog/pages/ReferenceFormPage'
import { ReferenceListPage } from '../modules/catalog/pages/ReferenceListPage'
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
          { path: 'products', element: <ProductsPage /> },
          { path: 'products/:id', element: <ProductDetailPage /> },
          { path: 'categories', element: <ReferenceListPage kind="category" /> },
          { path: 'price-levels', element: <ReferenceListPage kind="price-level" /> },
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
              { path: 'products/new', element: <ProductFormPage /> },
              { path: 'products/:id/edit', element: <ProductFormPage /> },
              {
                path: 'products/:id/prices',
                element: placeholder(
                  'Precios del producto',
                  'Escalas por nivel y cantidad mínima.',
                ),
              },
              {
                path: 'products/:id/images',
                element: <ProductImagesPage />,
              },
              { path: 'categories/new', element: <ReferenceFormPage kind="category" /> },
              {
                path: 'categories/:id/edit',
                element: <ReferenceFormPage kind="category" />,
              },
              {
                path: 'price-levels/new',
                element: <ReferenceFormPage kind="price-level" />,
              },
              {
                path: 'price-levels/:id/edit',
                element: <ReferenceFormPage kind="price-level" />,
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
