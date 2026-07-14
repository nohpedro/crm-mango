import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { catalogService } from '../services/catalog.service'
import type {
  CatalogWriteRequest,
  ProductFilters,
  ProductImageWriteRequest,
  ProductWriteRequest,
} from '../types/catalog.types'

export const catalogQueryKeys = {
  categories: (filters: ProductFilters) => ['categories', filters] as const,
  category: (id: string) => ['category', id] as const,
  priceLevels: (filters: ProductFilters) => ['price-levels', filters] as const,
  priceLevel: (id: string) => ['price-level', id] as const,
  products: (filters: ProductFilters) => ['products', filters] as const,
  product: (id: string) => ['product', id] as const,
}

export function useCategories(filters: ProductFilters) {
  return useQuery({
    queryKey: catalogQueryKeys.categories(filters),
    queryFn: () => catalogService.listCategories(filters),
  })
}
export function useCategory(id: string | undefined) {
  return useQuery({
    queryKey: catalogQueryKeys.category(id ?? ''),
    queryFn: () => catalogService.getCategory(id ?? ''),
    enabled: Boolean(id),
  })
}
export function usePriceLevels(filters: ProductFilters) {
  return useQuery({
    queryKey: catalogQueryKeys.priceLevels(filters),
    queryFn: () => catalogService.listPriceLevels(filters),
  })
}
export function usePriceLevel(id: string | undefined) {
  return useQuery({
    queryKey: catalogQueryKeys.priceLevel(id ?? ''),
    queryFn: () => catalogService.getPriceLevel(id ?? ''),
    enabled: Boolean(id),
  })
}
export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: catalogQueryKeys.products(filters),
    queryFn: () => catalogService.listProducts(filters),
  })
}
export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: catalogQueryKeys.product(id ?? ''),
    queryFn: () => catalogService.getProduct(id ?? ''),
    enabled: Boolean(id),
  })
}

export function useCategoryMutations() {
  const client = useQueryClient()
  const invalidate = () => client.invalidateQueries({ queryKey: ['categories'] })
  return {
    create: useMutation({
      mutationFn: catalogService.createCategory,
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        payload,
      }: {
        id: string
        payload: Partial<CatalogWriteRequest>
      }) => catalogService.updateCategory(id, payload),
      onSuccess: invalidate,
    }),
  }
}

export function usePriceLevelMutations() {
  const client = useQueryClient()
  const invalidate = () => client.invalidateQueries({ queryKey: ['price-levels'] })
  return {
    create: useMutation({
      mutationFn: catalogService.createPriceLevel,
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        payload,
      }: {
        id: string
        payload: Partial<CatalogWriteRequest>
      }) => catalogService.updatePriceLevel(id, payload),
      onSuccess: invalidate,
    }),
  }
}

export function useProductMutations() {
  const client = useQueryClient()
  const invalidate = (id?: string) => {
    void client.invalidateQueries({ queryKey: ['products'] })
    if (id) void client.invalidateQueries({ queryKey: catalogQueryKeys.product(id) })
  }
  return {
    create: useMutation({
      mutationFn: catalogService.createProduct,
      onSuccess: () => invalidate(),
    }),
    update: useMutation({
      mutationFn: ({
        id,
        payload,
      }: {
        id: string
        payload: Partial<ProductWriteRequest>
      }) => catalogService.updateProduct(id, payload),
      onSuccess: (_, values) => invalidate(values.id),
    }),
    delete: useMutation({
      mutationFn: catalogService.deleteProduct,
      onSuccess: (_, id) => invalidate(id),
    }),
    activate: useMutation({
      mutationFn: catalogService.activateProduct,
      onSuccess: (_, id) => invalidate(id),
    }),
    deactivate: useMutation({
      mutationFn: catalogService.deactivateProduct,
      onSuccess: (_, id) => invalidate(id),
    }),
    restore: useMutation({
      mutationFn: catalogService.restoreProduct,
      onSuccess: (_, id) => invalidate(id),
    }),
  }
}

export function useProductImageMutations(productId: string | undefined) {
  const client = useQueryClient()
  const invalidate = () => {
    if (productId)
      void client.invalidateQueries({ queryKey: catalogQueryKeys.product(productId) })
  }
  return {
    upload: useMutation({
      mutationFn: (payload: ProductImageWriteRequest) =>
        catalogService.createProductImage(payload),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        payload,
      }: {
        id: string
        payload: Partial<{ alt_text: string; is_primary: boolean; position: number }>
      }) => catalogService.updateProductImage(id, payload),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: catalogService.deleteProductImage,
      onSuccess: invalidate,
    }),
  }
}
