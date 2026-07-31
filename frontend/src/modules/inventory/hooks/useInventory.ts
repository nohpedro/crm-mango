import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { inventoryService } from '../services/inventory.service'
export function useWarehouses(
  params: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: ['warehouses', params],
    queryFn: () => inventoryService.warehouses(params),
  })
}
export function useWarehouse(id?: string) {
  return useQuery({
    queryKey: ['warehouse', id],
    queryFn: () => inventoryService.warehouse(id ?? ''),
    enabled: Boolean(id),
  })
}
export function useWarehouseMutations() {
  const c = useQueryClient()
  const inv = () => c.invalidateQueries({ queryKey: ['warehouses'] })
  return {
    create: useMutation({ mutationFn: inventoryService.createWarehouse, onSuccess: inv }),
    update: useMutation({
      mutationFn: ({
        id,
        payload,
      }: {
        id: string
        payload: Partial<Parameters<typeof inventoryService.createWarehouse>[0]>
      }) => inventoryService.updateWarehouse(id, payload),
      onSuccess: inv,
    }),
  }
}
export function useStocks(params: Record<string, string | number | boolean | undefined>) {
  return useQuery({
    queryKey: ['stocks', params],
    queryFn: () => inventoryService.stocks(params),
  })
}
export function useStock(id?: string) {
  return useQuery({
    queryKey: ['stock', id],
    queryFn: () => inventoryService.stock(id ?? ''),
    enabled: Boolean(id),
  })
}
export function useStockMutations() {
  const c = useQueryClient()
  const inv = () => {
    void c.invalidateQueries({ queryKey: ['stocks'] })
    void c.invalidateQueries({ queryKey: ['products'] })
  }
  return {
    create: useMutation({ mutationFn: inventoryService.createStock, onSuccess: inv }),
    update: useMutation({
      mutationFn: ({ id, minimum_stock }: { id: string; minimum_stock: number }) =>
        inventoryService.updateStock(id, minimum_stock),
      onSuccess: inv,
    }),
  }
}
export function useMovements(
  params: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: ['movements', params],
    queryFn: () => inventoryService.movements(params),
  })
}
export function useMovementMutation() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: inventoryService.createMovement,
    onSuccess: () => {
      void c.invalidateQueries({ queryKey: ['movements'] })
      void c.invalidateQueries({ queryKey: ['stocks'] })
    },
  })
}
