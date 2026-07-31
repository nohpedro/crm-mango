import axios from 'axios'

import type { ApiError } from '../types/api'

const toMessages = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return [value]
  return []
}

export function normalizeApiError(error: unknown): ApiError {
  if (!axios.isAxiosError(error)) {
    return {
      status: null,
      message: error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
      fieldErrors: {},
      nonFieldErrors: [],
      isNetworkError: false,
      original: error,
    }
  }

  const status = error.response?.status ?? null
  const data: unknown = error.response?.data
  const fieldErrors: Record<string, string[]> = {}
  let nonFieldErrors: string[] = []
  let detail: string | undefined

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
      const messages = toMessages(value)
      if (key === 'detail' && messages[0]) detail = messages[0]
      else if (key === 'non_field_errors') nonFieldErrors = messages
      else if (messages.length) fieldErrors[key] = messages
    })
  }

  const isNetworkError = !error.response
  const message =
    (status === 415
      ? 'No se pudo procesar la información enviada. Inténtalo nuevamente.'
      : undefined) ??
    detail ??
    nonFieldErrors[0] ??
    Object.values(fieldErrors)[0]?.[0] ??
    (isNetworkError
      ? 'No se pudo conectar con el servidor. Verifica que el backend esté disponible.'
      : 'La solicitud no pudo completarse.')

  return {
    status,
    message,
    fieldErrors,
    nonFieldErrors,
    isNetworkError,
    original: data ?? error,
  }
}

export class ApiRequestError extends Error {
  public readonly details: ApiError

  public constructor(details: ApiError) {
    super(details.message)
    this.name = 'ApiRequestError'
    this.details = details
  }
}
