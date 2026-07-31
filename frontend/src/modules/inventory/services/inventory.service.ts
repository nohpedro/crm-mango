import { requestHandler } from '../../auth/services/auth.service'
import type { PaginatedResponse } from '../../../types/api'
import type {
  Stock,
  StockMovement,
  Warehouse,
  WarehouseWrite,
} from '../types/inventory.types'
export const inventoryService = {
  warehouses: (params: Record<string, string | number | boolean | undefined> = {}) =>
    requestHandler.get<PaginatedResponse<Warehouse>>('inventory/warehouses/', { params }),
  warehouse: (id: string) => requestHandler.get<Warehouse>(`inventory/warehouses/${id}/`),
  createWarehouse: (payload: WarehouseWrite) =>
    requestHandler.post<Warehouse, WarehouseWrite>('inventory/warehouses/', payload),
  updateWarehouse: (id: string, payload: Partial<WarehouseWrite>) =>
    requestHandler.patch<Warehouse, Partial<WarehouseWrite>>(
      `inventory/warehouses/${id}/`,
      payload,
    ),
  stocks: (params: Record<string, string | number | boolean | undefined> = {}) =>
    requestHandler.get<PaginatedResponse<Stock>>('inventory/stocks/', { params }),
  stock: (id: string) => requestHandler.get<Stock>(`inventory/stocks/${id}/`),
  createStock: (payload: { product: string; warehouse: string; minimum_stock: number }) =>
    requestHandler.post<Stock, typeof payload>('inventory/stocks/', payload),
  updateStock: (id: string, minimum_stock: number) =>
    requestHandler.patch<Stock, { minimum_stock: number }>(`inventory/stocks/${id}/`, {
      minimum_stock,
    }),
  movements: (params: Record<string, string | number | boolean | undefined> = {}) =>
    requestHandler.get<PaginatedResponse<StockMovement>>('inventory/movements/', {
      params,
    }),
  createMovement: (payload: {
    stock: string
    movement_type: string
    quantity: number
    reference: string
    notes: string
  }) =>
    requestHandler.post<StockMovement, typeof payload>('inventory/movements/', payload),
}
