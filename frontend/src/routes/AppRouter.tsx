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
import { ProtectedRoute } from './ProtectedRoute'
import { PublicOnlyRoute } from './PublicOnlyRoute'
import { PermissionGate } from './PermissionGate'
import { StatusPage } from '../modules/shared/pages/StatusPage'
const adminChildren = [
  { path: 'users', element: <PermissionGate anyOf={['users.view_user']}><UsersPage /></PermissionGate> },
  { path: 'users/new', element: <PermissionGate anyOf={['users.add_user']}><UserFormPage /></PermissionGate> },
  { path: 'users/:id/edit', element: <PermissionGate anyOf={['users.change_user']}><UserFormPage /></PermissionGate> },
  { path: 'roles', element: <PermissionGate anyOf={['users.view_role']}><RolesPage /></PermissionGate> },
  { path: 'roles/new', element: <PermissionGate anyOf={['users.add_role']}><RoleFormPage /></PermissionGate> },
  { path: 'roles/:id/edit', element: <PermissionGate anyOf={['users.change_role']}><RoleFormPage /></PermissionGate> },
  { path: 'clients/import-export', element: <PermissionGate anyOf={['clients.view_client', 'clients.add_client']}><DataTransferPage resource="clients" /></PermissionGate> },
  { path: 'products/new', element: <PermissionGate anyOf={['products.add_product']}><ProductFormPage /></PermissionGate> },
  { path: 'products/:id/edit', element: <PermissionGate anyOf={['products.change_product']}><ProductFormPage /></PermissionGate> },
  { path: 'products/:id/images', element: <PermissionGate allOf={['products.view_product']} anyOf={['products.view_productimage', 'products.add_productimage', 'products.change_productimage', 'products.delete_productimage']}><ProductImagesPage /></PermissionGate> },
  { path: 'products/:id/prices', element: <PermissionGate allOf={['products.view_product']} anyOf={['products.view_productprice', 'products.add_productprice', 'products.change_productprice']}><ProductPricesPage /></PermissionGate> },
  { path: 'price-levels/:id/rules', element: <PermissionGate allOf={['products.view_pricelevel', 'products.view_pricetier']}><PriceLevelRulesPage /></PermissionGate> },
  { path: 'products/import-export', element: <PermissionGate anyOf={['products.view_product', 'products.add_product']}><DataTransferPage resource="products" /></PermissionGate> },
  {
    path: 'inventory/warehouses/import-export',
    element: <PermissionGate anyOf={['inventory.view_warehouse', 'inventory.add_warehouse']}><DataTransferPage resource="warehouses" /></PermissionGate>,
  },
  {
    path: 'inventory/stocks/import-export',
    element: <PermissionGate anyOf={['inventory.view_stock', 'inventory.add_stock']}><DataTransferPage resource="stocks" /></PermissionGate>,
  },
  { path: 'categories/new', element: <PermissionGate anyOf={['products.add_category']}><ReferenceFormPage kind="category" /></PermissionGate> },
  { path: 'categories/:id/edit', element: <PermissionGate anyOf={['products.change_category']}><ReferenceFormPage kind="category" /></PermissionGate> },
  { path: 'products/categories/new', element: <PermissionGate anyOf={['products.add_category']}><ReferenceFormPage kind="category" /></PermissionGate> },
  {
    path: 'products/categories/:id/edit',
    element: <PermissionGate anyOf={['products.change_category']}><ReferenceFormPage kind="category" /></PermissionGate>,
  },
  { path: 'price-levels/new', element: <PermissionGate anyOf={['products.add_pricelevel']}><ReferenceFormPage kind="price-level" /></PermissionGate> },
  { path: 'price-levels/:id/edit', element: <PermissionGate anyOf={['products.change_pricelevel']}><ReferenceFormPage kind="price-level" /></PermissionGate> },
  {
    path: 'products/price-levels/new',
    element: <PermissionGate anyOf={['products.add_pricelevel']}><ReferenceFormPage kind="price-level" /></PermissionGate>,
  },
  {
    path: 'products/price-levels/:id/edit',
    element: <PermissionGate anyOf={['products.change_pricelevel']}><ReferenceFormPage kind="price-level" /></PermissionGate>,
  },
  { path: 'inventory/warehouses/new', element: <PermissionGate anyOf={['inventory.add_warehouse']}><WarehouseFormPage /></PermissionGate> },
  { path: 'inventory/warehouses/:id/edit', element: <PermissionGate anyOf={['inventory.change_warehouse']}><WarehouseFormPage /></PermissionGate> },
  { path: 'inventory/stocks/new', element: <PermissionGate anyOf={['inventory.add_stock']}><StockFormPage /></PermissionGate> },
  { path: 'inventory/stocks/:id/edit', element: <PermissionGate anyOf={['inventory.change_stock']}><StockFormPage /></PermissionGate> },
  { path: 'inventory/movements/new', element: <PermissionGate anyOf={['inventory.add_stockmovement']}><MovementFormPage /></PermissionGate> },
]
const appChildren = [
  { index: true, element: <Navigate to="/dashboard" replace /> },
  { path: 'dashboard', element: <DashboardPage /> },
  {
    path: 'clients',
    element: <PermissionGate anyOf={['clients.view_client']}><ClientsPage /></PermissionGate>,
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
    element: <PermissionGate anyOf={['quotations.manage_quotation_templates']}><QuotationTemplatesPage /></PermissionGate>,
  },
  {
    path: 'products',
    element: <PermissionGate anyOf={['products.view_product']}><ProductsPage /></PermissionGate>,
  },
  {
    path: 'products/:id',
    element: <PermissionGate anyOf={['products.view_product']}><ProductDetailPage /></PermissionGate>,
  },
  { path: 'categories', element: <PermissionGate anyOf={['products.view_category']}><ReferenceListPage kind="category" /></PermissionGate> },
  { path: 'price-levels', element: <PermissionGate anyOf={['products.view_pricelevel']}><ReferenceListPage kind="price-level" /></PermissionGate> },
  { path: 'products/categories', element: <PermissionGate anyOf={['products.view_category']}><ReferenceListPage kind="category" /></PermissionGate> },
  { path: 'products/price-levels', element: <PermissionGate anyOf={['products.view_pricelevel']}><ReferenceListPage kind="price-level" /></PermissionGate> },
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
  ...adminChildren,
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
