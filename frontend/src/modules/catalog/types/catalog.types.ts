import type { PaginatedResponse } from '../../../types/api'

export interface Category {
  id: string
  name: string
  code: string
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PriceLevel {
  id: string
  name: string
  code: string
  description: string
  tiers: PriceTier[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PriceTier {
  id: string
  price_level: string
  price_level_detail: { id: string; name: string; code: string }
  minimum_quantity: number
  label: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: string
  product: string
  image: string
  alt_text: string
  is_primary: boolean
  position: number
  created_at: string
}

export interface ProductImageWriteRequest {
  product: string
  image: File
  alt_text?: string
  is_primary?: boolean
  position?: number
}

export interface ProductPrice {
  id: string
  product: string
  product_detail: { id: string; name: string; sku: string }
  price_level: string
  price_tier: string | null
  price_tier_detail: PriceTier | null
  price_level_detail: { id: string; name: string; code: string }
  minimum_quantity: number
  unit_price: string
  discount_percent: string
  is_active: boolean
  valid_from: string
  valid_until: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProductSummary {
  id: string
  name: string
  sku: string
  barcode: string | null
  category: { id: string; name: string; code: string }
  normal_unit_price: string
  is_active: boolean
  deleted_at: string | null
  primary_image: string | null
  total_stock: number
  available_stock: number
  has_stock: boolean
  created_at: string
  updated_at: string
}

export interface ProductDetail extends ProductSummary {
  description: string
  normal_unit_price: string
  images: ProductImage[]
  prices: ProductPrice[]
  created_by: string | null
  updated_by: string | null
}

export interface CatalogWriteRequest {
  name: string
  code: string
  description: string
  is_active: boolean
}

export interface ProductWriteRequest {
  category: string
  name: string
  sku: string
  barcode: string | null
  description: string
  normal_unit_price: number
  is_active: boolean
}

export interface QuotationProductPrice {
  quantity: number
  total_quantity: number
  normal_unit_price: string
  special_unit_price: string | null
  final_unit_price: string
  price_level: { id: string; name: string; code: string } | null
  price_tier: { id: string; label: string } | null
  minimum_quantity: number | null
  discount_percent: string
  savings_per_unit: string
}

export interface ProductPriceWriteRequest {
  product: string
  price_level?: string
  price_tier: string
  minimum_quantity?: number
  unit_price: number
  discount_percent: number
  is_active: boolean
}

export interface ProductFilters {
  search: string
  category: string
  sku: string
  is_active: string
  include_deleted: boolean
  ordering: string
  page: number
}

export type PaginatedCategories = PaginatedResponse<Category>
export type PaginatedPriceLevels = PaginatedResponse<PriceLevel>
export type PaginatedPriceTiers = PaginatedResponse<PriceTier>
export type PaginatedProducts = PaginatedResponse<ProductSummary>
