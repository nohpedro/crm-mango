import { requestHandler } from '../../auth/services/auth.service'
import type { PaginatedResponse } from '../../../types/api'
import type {
  Category,
  CatalogWriteRequest,
  PriceLevel,
  ProductDetail,
  ProductFilters,
  ProductImage,
  ProductImageWriteRequest,
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
