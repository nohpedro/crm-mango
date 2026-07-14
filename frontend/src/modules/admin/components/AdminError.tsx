import { ApiRequestError } from '../../../services/apiError'

export function getAdminErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) return error.details.message
  return fallback
}

export function getFieldErrors(error: unknown) {
  if (error instanceof ApiRequestError) return error.details.fieldErrors
  return {}
}
