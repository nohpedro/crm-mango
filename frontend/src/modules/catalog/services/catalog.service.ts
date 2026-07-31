import { requestHandler } from '../../auth/services/auth.service'
import type { PaginatedResponse } from '../../../types/api'
import type {
  Category,
  CatalogWriteRequest,
  PriceLevel,
  PriceTier,
  ProductDetail,
  ProductFilters,
  ProductImage,
  ProductImageWriteRequest,
  ProductPrice,
  ProductPriceWriteRequest,
  QuotationProductPrice,
  ProductSummary,
  ProductWriteRequest,
} from '../types/catalog.types'

const baseParams = (filters: ProductFilters) => ({
  search: filters.search || undefined,
  ordering: filters.ordering || undefined,
  page: filters.page,
})

export const catalogService = {
  listCategories: (filters: ProductFilters) =>
    requestHandler.get<PaginatedResponse<Category>>('catalog/categories/', {
      params: { ...baseParams(filters), is_active: filters.is_active || undefined },
    }),
  getCategory: (id: string) => requestHandler.get<Category>(`catalog/categories/${id}/`),
  createCategory: (payload: CatalogWriteRequest) =>
    requestHandler.post<Category, CatalogWriteRequest>('catalog/categories/', payload),
  updateCategory: (id: string, payload: Partial<CatalogWriteRequest>) =>
    requestHandler.patch<Category, Partial<CatalogWriteRequest>>(
      `catalog/categories/${id}/`,
      payload,
    ),

  listPriceLevels: (filters: ProductFilters) =>
    requestHandler.get<PaginatedResponse<PriceLevel>>('catalog/price-levels/', {
      params: { ...baseParams(filters), is_active: filters.is_active || undefined },
    }),
  listPriceTiers: (params: Record<string, string | number | boolean | undefined>) =>
    requestHandler.get<PaginatedResponse<PriceTier>>('catalog/price-tiers/', { params }),
  createPriceTier: (payload: { price_level: string; minimum_quantity: number; is_active: boolean }) =>
    requestHandler.post<PriceTier, typeof payload>('catalog/price-tiers/', payload),
  updatePriceTier: (
    id: string,
    payload: Partial<Pick<PriceTier, 'minimum_quantity' | 'is_active'>>,
  ) =>
    requestHandler.patch<PriceTier, typeof payload>(
      `catalog/price-tiers/${id}/`,
      payload,
    ),
  deletePriceTier: (id: string) =>
    requestHandler.delete<void>(`catalog/price-tiers/${id}/`),
  getPriceLevel: (id: string) =>
    requestHandler.get<PriceLevel>(`catalog/price-levels/${id}/`),
  createPriceLevel: (payload: CatalogWriteRequest) =>
    requestHandler.post<PriceLevel, CatalogWriteRequest>(
      'catalog/price-levels/',
      payload,
    ),
  updatePriceLevel: (id: string, payload: Partial<CatalogWriteRequest>) =>
    requestHandler.patch<PriceLevel, Partial<CatalogWriteRequest>>(
      `catalog/price-levels/${id}/`,
      payload,
    ),

  listProducts: (filters: ProductFilters) =>
    requestHandler.get<PaginatedResponse<ProductSummary>>('catalog/products/', {
      params: {
        ...baseParams(filters),
        category: filters.category || undefined,
        sku: filters.sku || undefined,
        is_active: filters.is_active || undefined,
        include_deleted: filters.include_deleted || undefined,
      },
    }),
  getProduct: (id: string) =>
    requestHandler.get<ProductDetail>(`catalog/products/${id}/`),
  getQuotationPrice: (
    id: string,
    params: { quantity: number; total_quantity: number; client?: string },
  ) =>
    requestHandler.get<QuotationProductPrice>(`catalog/products/${id}/quotation-price/`, {
      params,
    }),
  createProductPrice: (payload: ProductPriceWriteRequest) =>
    requestHandler.post<ProductPrice, ProductPriceWriteRequest>(
      'catalog/product-prices/',
      payload,
    ),
  updateProductPrice: (id: string, payload: Partial<ProductPriceWriteRequest>) =>
    requestHandler.patch<ProductPrice, Partial<ProductPriceWriteRequest>>(
      `catalog/product-prices/${id}/`,
      payload,
    ),
  listProductPrices: (params: Record<string, string | number | boolean | undefined>) =>
    requestHandler.get<PaginatedResponse<ProductPrice>>('catalog/product-prices/', {
      params,
    }),
  createProduct: (payload: ProductWriteRequest) =>
    requestHandler.post<ProductDetail, ProductWriteRequest>('catalog/products/', payload),
  updateProduct: (id: string, payload: Partial<ProductWriteRequest>) =>
    requestHandler.patch<ProductDetail, Partial<ProductWriteRequest>>(
      `catalog/products/${id}/`,
      payload,
    ),
  deleteProduct: (id: string) => requestHandler.delete<void>(`catalog/products/${id}/`),
  activateProduct: (id: string) =>
    requestHandler.post<ProductDetail>(`catalog/products/${id}/activate/`),
  deactivateProduct: (id: string) =>
    requestHandler.post<ProductDetail>(`catalog/products/${id}/deactivate/`),
  restoreProduct: (id: string) =>
    requestHandler.post<ProductDetail>(`catalog/products/${id}/restore/`),

  createProductImage: ({
    product,
    image,
    alt_text,
    is_primary,
    position,
  }: ProductImageWriteRequest) =>
    requestHandler.postMultipart<ProductImage>('catalog/product-images/', {
      fields: { product, alt_text, is_primary, position },
      files: { image },
    }),
  updateProductImage: (
    id: string,
    payload: Partial<Pick<ProductImage, 'alt_text' | 'is_primary' | 'position'>>,
  ) =>
    requestHandler.patch<ProductImage, typeof payload>(
      `catalog/product-images/${id}/`,
      payload,
    ),
  deleteProductImage: (id: string) =>
    requestHandler.delete<void>(`catalog/product-images/${id}/`),
}
