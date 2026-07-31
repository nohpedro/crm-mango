import { requestHandler } from '../../auth/services/auth.service'
import type { PaginatedResponse } from '../../../types/api'
import type { Client, ClientType, ClientWriteRequest } from '../types/client.types'

export const clientService = {
  list: (params: Record<string, string | number | boolean | undefined>) =>
    requestHandler.get<PaginatedResponse<Client>>('clients/', { params }),
  get: (id: string) => requestHandler.get<Client>(`clients/${id}/`),
  create: (payload: ClientWriteRequest) =>
    requestHandler.post<Client, ClientWriteRequest>('clients/', payload),
  update: (id: string, payload: Partial<ClientWriteRequest>) =>
    requestHandler.patch<Client, Partial<ClientWriteRequest>>(`clients/${id}/`, payload),
  listTypes: () => requestHandler.get<PaginatedResponse<ClientType>>('clients/types/'),
  createType: (name: string) =>
    requestHandler.post<ClientType, { name: string }>('clients/types/', { name }),
}
