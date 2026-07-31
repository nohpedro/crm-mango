export interface Warehouse {
  id: string
  name: string
  code: string
  description: string
  address: string
  is_active: boolean
  created_at: string
  updated_at: string
}
export interface Stock {
  id: string
  product: { id: string; name: string; sku: string; category: { name: string } }
  warehouse: { id: string; name: string; code: string }
  quantity: number
  reserved_quantity: number
  available_quantity: number
  minimum_stock: number
  is_below_minimum: boolean
  updated_at: string
}
export interface StockSummary {
  id: string
  product_id: string
  product_name: string
  product_sku: string
  warehouse_id: string
  warehouse_name: string
}
export interface StockMovement {
  id: string
  stock: StockSummary
  movement_type: string
  movement_type_display: string
  quantity_delta: number
  previous_quantity: number
  resulting_quantity: number
  reference: string
  notes: string
  created_by_username: string
  created_at: string
}
export interface WarehouseWrite {
  name: string
  code: string
  description: string
  address: string
  is_active: boolean
}
