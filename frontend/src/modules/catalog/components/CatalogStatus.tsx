import { getAdminErrorMessage } from '../../admin/components/AdminError'

export function catalogError(error: unknown, fallback: string) {
  return getAdminErrorMessage(error, fallback)
}
