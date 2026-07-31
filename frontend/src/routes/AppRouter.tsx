import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { LoginPage } from '../modules/auth/pages/LoginPage'
import { ClientsPage } from '../modules/clients/pages/ClientsPage'
import { ClientFormPage } from '../modules/clients/pages/ClientFormPage'
import { ProductsPage } from '../modules/catalog/pages/ProductsPage'
import { ProductDetailPage } from '../modules/catalog/pages/ProductDetailPage'
import { ProductFormPage } from '../modules/catalog/pages/ProductFormPage'
import { ReferenceListPage } from '../modules/catalog/pages/ReferenceListPage'
import { ReferenceFormPage } from '../modules/catalog/pages/ReferenceFormPage'
import { ProductImagesPage } from '../modules/catalog/pages/ProductImagesPage'
import { ProductPricesPage } from '../modules/catalog/pages/ProductPricesPage'
import { PriceLevelRulesPage } from '../modules/catalog/pages/PriceLevelRulesPage'
import { DataTransferPage } from '../modules/dataTransfer/pages/DataTransferPage'
import { DashboardPage } from '../modules/dashboard/pages/DashboardPage'
import { WarehousesPage } from '../modules/inventory/pages/WarehousesPage'
import { WarehouseFormPage } from '../modules/inventory/pages/WarehouseFormPage'
import { StocksPage } from '../modules/inventory/pages/StocksPage'
import { StockFormPage } from '../modules/inventory/pages/StockFormPage'
import { MovementsPage } from '../modules/inventory/pages/MovementsPage'
import { MovementFormPage } from '../modules/inventory/pages/MovementFormPage'
import { QuotationsPage } from '../modules/quotations/pages/QuotationsPage'
import { QuotationFormPage } from '../modules/quotations/pages/QuotationFormPage'
import { QuotationDetailPage } from '../modules/quotations/pages/QuotationDetailPage'
import { QuotationTemplatesPage } from '../modules/quotations/pages/QuotationTemplatesPage'
import { RolesPage } from '../modules/admin/pages/RolesPage'
import { RoleFormPage } from '../modules/admin/pages/RoleFormPage'
import { UsersPage } from '../modules/admin/pages/UsersPage'
import { UserFormPage } from '../modules/admin/pages/UserFormPage'
import { AdminRoute } from './AdminRoute'
import { ProtectedRoute } from './ProtectedRoute'
import { PublicOnlyRoute } from './PublicOnlyRoute'
import { PermissionGate } from './PermissionGate'
import { StatusPage } from '../modules/shared/pages/StatusPage'
const adminChildren = [
  { path: 'users', element: <UsersPage /> },
  { path: 'users/new', element: <UserFormPage /> },
  { path: 'users/:id/edit', element: <UserFormPage /> },
  { path: 'roles', element: <RolesPage /> },
  { path: 'roles/new', element: <RoleFormPage /> },
  { path: 'roles/:id/edit', element: <RoleFormPage /> },
  { path: 'clients/import-export', element: <DataTransferPage resource="clients" /> },
  { path: 'products/new', element: <ProductFormPage /> },
  { path: 'products/:id/edit', element: <ProductFormPage /> },
  { path: 'products/:id/images', element: <ProductImagesPage /> },
  { path: 'products/:id/prices', element: <ProductPricesPage /> },
  { path: 'price-levels/:id/rules', element: <PriceLevelRulesPage /> },
  { path: 'products/import-export', element: <DataTransferPage resource="products" /> },
  {
    path: 'inventory/warehouses/import-export',
    element: <DataTransferPage resource="warehouses" />,
  },
  {
    path: 'inventory/stocks/import-export',
    element: <DataTransferPage resource="stocks" />,
  },
  { path: 'categories/new', element: <ReferenceFormPage kind="category" /> },
  { path: 'categories/:id/edit', element: <ReferenceFormPage kind="category" /> },
  { path: 'products/categories/new', element: <ReferenceFormPage kind="category" /> },
  {
    path: 'products/categories/:id/edit',
    element: <ReferenceFormPage kind="category" />,
  },
  { path: 'price-levels/new', element: <ReferenceFormPage kind="price-level" /> },
  { path: 'price-levels/:id/edit', element: <ReferenceFormPage kind="price-level" /> },
  {
    path: 'products/price-levels/new',
    element: <ReferenceFormPage kind="price-level" />,
  },
  {
    path: 'products/price-levels/:id/edit',
    element: <ReferenceFormPage kind="price-level" />,
  },
  { path: 'inventory/warehouses/new', element: <WarehouseFormPage /> },
  { path: 'inventory/warehouses/:id/edit', element: <WarehouseFormPage /> },
  { path: 'inventory/stocks/new', element: <StockFormPage /> },
  { path: 'inventory/stocks/:id/edit', element: <StockFormPage /> },
  { path: 'inventory/movements/new', element: <MovementFormPage /> },
]
const appChildren = [
  { index: true, element: <Navigate to="/dashboard" replace /> },
  { path: 'dashboard', element: <DashboardPage /> },
  {
    path: 'clients',
    element: <PermissionGate anyOf={['clients.view_client', 'clients.add_client']}><ClientsPage /></PermissionGate>,
  },
  {
    path: 'clients/new',
    element: <PermissionGate anyOf={['clients.add_client']}><ClientFormPage /></PermissionGate>,
  },
  {
    path: 'clients/:id/edit',
    element: <PermissionGate anyOf={['clients.change_client']}><ClientFormPage /></PermissionGate>,
  },
  {
    path: 'quotations',
    element: <PermissionGate anyOf={['quotations.add_quotation']}><QuotationFormPage /></PermissionGate>,
  },
  { path: 'quotations/new', element: <Navigate to="/quotations" replace /> },
  {
    path: 'quotations/history',
    element: <PermissionGate anyOf={['quotations.view_quotation']}><QuotationsPage /></PermissionGate>,
  },
  {
    path: 'quotations/:id',
    element: <PermissionGate anyOf={['quotations.view_quotation']}><QuotationDetailPage /></PermissionGate>,
  },
  {
    path: 'quotations/:id/edit',
    element: <PermissionGate anyOf={['quotations.change_quotation']}><QuotationFormPage /></PermissionGate>,
  },
  {
    path: 'quotations/templates',
    element: <PermissionGate anyOf={['quotations.change_quotation']}><QuotationTemplatesPage /></PermissionGate>,
  },
  {
    path: 'products',
    element: <PermissionGate anyOf={['products.view_product', 'products.add_product']}><ProductsPage /></PermissionGate>,
  },
  {
    path: 'products/:id',
    element: <PermissionGate anyOf={['products.view_product']}><ProductDetailPage /></PermissionGate>,
  },
  { path: 'categories', element: <ReferenceListPage kind="category" /> },
  { path: 'price-levels', element: <ReferenceListPage kind="price-level" /> },
  { path: 'products/categories', element: <ReferenceListPage kind="category" /> },
  { path: 'products/price-levels', element: <ReferenceListPage kind="price-level" /> },
  {
    path: 'inventory',
    element: <PermissionGate anyOf={['inventory.view_stock']}><StocksPage /></PermissionGate>,
  },
  {
    path: 'inventory/warehouses',
    element: <PermissionGate anyOf={['inventory.view_warehouse']}><WarehousesPage /></PermissionGate>,
  },
  {
    path: 'inventory/stocks',
    element: <PermissionGate anyOf={['inventory.view_stock']}><StocksPage /></PermissionGate>,
  },
  {
    path: 'inventory/movements',
    element: <PermissionGate anyOf={['inventory.view_stockmovement']}><MovementsPage /></PermissionGate>,
  },
  { element: <AdminRoute />, children: adminChildren },
]
const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [{ element: <AppLayout />, children: appChildren }],
  },
  {
    path: '/unauthorized',
    element: (
      <StatusPage
        code="403"
        title="Acceso no autorizado"
        description="No tienes permisos suficientes."
        unauthorized
      />
    ),
  },
  {
    path: '*',
    element: (
      <StatusPage
        code="404"
        title="Página no encontrada"
        description="La dirección solicitada no existe."
      />
    ),
  },
])
export function AppRouter() {
  return <RouterProvider router={router} />
}
