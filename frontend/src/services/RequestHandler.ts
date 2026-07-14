import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosRequestHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  type Method,
} from 'axios'

import { getApiUrl } from '../config/env'
import { notifySessionExpired } from '../modules/auth/services/sessionEvents'
import { tokenStorage } from '../modules/auth/services/tokenStorage'
import type { RefreshResponse } from '../modules/auth/types/auth.types'
import { ApiRequestError, normalizeApiError } from './apiError'

export type QueryParams = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  params?: QueryParams
  headers?: AxiosRequestHeaders
  signal?: AbortSignal
  skipAuthRefresh?: boolean
}

export interface MultipartPayload {
  fields?: Record<string, string | number | boolean | null | undefined>
  files?: Record<string, File | File[]>
}

interface RequestHandlerOptions {
  baseURL?: string
  timeout?: number
}

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
  skipAuthRefresh?: boolean
}

export class RequestHandler {
  public readonly client: AxiosInstance
  private readonly refreshClient: AxiosInstance
  private refreshPromise: Promise<string> | null = null

  public constructor(options: RequestHandlerOptions = {}) {
    const config = {
      baseURL: options.baseURL ?? getApiUrl(),
      timeout: options.timeout ?? 15_000,
      headers: { Accept: 'application/json' },
    }
    this.client = axios.create(config)
    this.refreshClient = axios.create(config)
    this.configureInterceptors()
  }

  public get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, options)
  }

  public post<TResponse, TBody = unknown>(
    endpoint: string,
    data?: TBody,
    options?: RequestOptions,
  ): Promise<TResponse> {
    return this.request<TResponse>('POST', endpoint, data, options)
  }

  public put<TResponse, TBody = unknown>(
    endpoint: string,
    data?: TBody,
    options?: RequestOptions,
  ): Promise<TResponse> {
    return this.request<TResponse>('PUT', endpoint, data, options)
  }

  public patch<TResponse, TBody = unknown>(
    endpoint: string,
    data?: TBody,
    options?: RequestOptions,
  ): Promise<TResponse> {
    return this.request<TResponse>('PATCH', endpoint, data, options)
  }

  public delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, options)
  }

  public postMultipart<T>(
    endpoint: string,
    payload: MultipartPayload,
    options?: RequestOptions,
  ): Promise<T> {
    return this.multipart<T>('POST', endpoint, payload, options)
  }

  public putMultipart<T>(
    endpoint: string,
    payload: MultipartPayload,
    options?: RequestOptions,
  ): Promise<T> {
    return this.multipart<T>('PUT', endpoint, payload, options)
  }

  public patchMultipart<T>(
    endpoint: string,
    payload: MultipartPayload,
    options?: RequestOptions,
  ): Promise<T> {
    return this.multipart<T>('PATCH', endpoint, payload, options)
  }

  public refreshSession(): Promise<string> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh().finally(() => {
        this.refreshPromise = null
      })
    }
    return this.refreshPromise
  }

  private configureInterceptors() {
    this.client.interceptors.request.use((config) => {
      const access = tokenStorage.getAccessToken()
      if (access) {
        config.headers = config.headers ?? new AxiosHeaders()
        config.headers.set('Authorization', `Bearer ${access}`)
      }
      return config
    })

    this.client.interceptors.response.use(
      (response) => response,
      async (error: unknown) => {
        if (
          !axios.isAxiosError(error) ||
          error.response?.status !== 401 ||
          !error.config
        ) {
          return Promise.reject(error)
        }

        const original = error.config as RetryableRequestConfig
        if (
          original._retry ||
          original.skipAuthRefresh ||
          !tokenStorage.getRefreshToken()
        ) {
          return Promise.reject(error)
        }

        original._retry = true
        try {
          const access = await this.refreshSession()
          original.headers = original.headers ?? new AxiosHeaders()
          original.headers.set('Authorization', `Bearer ${access}`)

          if (original.url?.includes('auth/logout/')) {
            original.data = JSON.stringify({ refresh: tokenStorage.getRefreshToken() })
          }

          return this.client.request(original)
        } catch (refreshError) {
          return Promise.reject(refreshError)
        }
      },
    )
  }

  private async performRefresh(): Promise<string> {
    const refresh = tokenStorage.getRefreshToken()
    if (!refresh) throw new Error('No existe una sesión renovable.')

    try {
      const response = await this.refreshClient.post<RefreshResponse>('auth/refresh/', {
        refresh,
      })
      tokenStorage.setTokens(response.data)
      return response.data.access
    } catch (error) {
      tokenStorage.clear()
      notifySessionExpired()
      throw error
    }
  }

  private async request<TResponse, TBody = unknown>(
    method: Method,
    endpoint: string,
    data?: TBody,
    options?: RequestOptions,
  ): Promise<TResponse> {
    const config: AxiosRequestConfig<TBody> & { skipAuthRefresh?: boolean } = {
      method,
      url: endpoint,
      data,
      params: options?.params,
      headers: options?.headers,
      signal: options?.signal,
      skipAuthRefresh: options?.skipAuthRefresh,
    }

    try {
      const response: AxiosResponse<TResponse> = await this.client.request(config)
      return response.data
    } catch (error) {
      if (error instanceof ApiRequestError) throw error
      throw new ApiRequestError(normalizeApiError(error))
    }
  }

  private multipart<TResponse>(
    method: 'POST' | 'PUT' | 'PATCH',
    endpoint: string,
    payload: MultipartPayload,
    options?: RequestOptions,
  ): Promise<TResponse> {
    const formData = new FormData()
    Object.entries(payload.fields ?? {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined) formData.append(key, String(value))
    })
    Object.entries(payload.files ?? {}).forEach(([key, value]) => {
      const files = Array.isArray(value) ? value : [value]
      files.forEach((file) => formData.append(key, file, file.name))
    })
    return this.request<TResponse>(method, endpoint, formData, options)
  }
}
