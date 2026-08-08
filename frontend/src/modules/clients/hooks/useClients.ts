import { useQuery } from '@tanstack/react-query'

import { clientService } from '../services/client.service'

export function useClients(
  params: Record<string, string | number | boolean | undefined>,
  enabled = true,
) {
  return useQuery({
    queryKey: ['clients', params],
    queryFn: () => clientService.list(params),
    enabled,
  })
}
