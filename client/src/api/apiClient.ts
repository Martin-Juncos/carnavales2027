import { appConfig } from '../app/config/env'
import type { ApiErrorBody, ApiSuccess, NormalizedApiError, RequestOptions } from '../types/api'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!isRecord(value) || !isRecord(value.error)) return false
  return typeof value.error.code === 'string' && typeof value.error.message === 'string'
}

export class ApiClientError extends Error implements NormalizedApiError {
  readonly code: string
  readonly status: number
  readonly retryable: boolean
  readonly requestId: string | undefined
  readonly details: unknown

  constructor(error: NormalizedApiError) {
    super(error.message)
    this.name = 'ApiClientError'
    this.code = error.code
    this.status = error.status
    this.retryable = error.retryable
    this.requestId = error.requestId
    this.details = error.details
  }
}

export function normalizeError(error: unknown): NormalizedApiError {
  if (error instanceof ApiClientError) return error
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { code: 'TIMEOUT', message: 'La solicitud tardó demasiado. Se reintentará cuando sea seguro.', status: 0, retryable: true }
  }
  if (error instanceof TypeError) {
    return { code: 'NETWORK_ERROR', message: 'No se pudo comunicar con el servidor.', status: 0, retryable: true }
  }
  if (error instanceof Error) {
    return { code: 'UNKNOWN_ERROR', message: error.message, status: 0, retryable: true }
  }
  return { code: 'UNKNOWN_ERROR', message: 'Ocurrió un error inesperado.', status: 0, retryable: true }
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  return JSON.parse(text) as unknown
}

async function requestEnvelope<T>(url: string, options: RequestOptions = {}): Promise<ApiSuccess<T>> {
  const controller = new AbortController()
  const { body, timeoutMs: requestedTimeoutMs, ...fetchOptions } = options
  const timeoutMs = requestedTimeoutMs ?? appConfig.apiTimeoutMs
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  const headers = new Headers(fetchOptions.headers)
  if (body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  try {
    const init: RequestInit = {
      ...fetchOptions,
      headers,
      credentials: 'include',
      signal: fetchOptions.signal ?? controller.signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }
    const response = await fetch(url, init)
    const payload = await readJson(response)

    if (!response.ok) {
      if (isApiErrorBody(payload)) {
        throw new ApiClientError({
          code: payload.error.code,
          message: payload.error.message,
          status: response.status,
          retryable: payload.error.retryable ?? (response.status >= 500 || response.status === 429),
          ...(payload.error.requestId ? { requestId: payload.error.requestId } : {}),
          ...(payload.error.details === undefined ? {} : { details: payload.error.details }),
        })
      }
      throw new ApiClientError({
        code: response.status >= 500 ? 'INTERNAL_ERROR' : 'UNKNOWN_ERROR',
        message: 'El servidor devolvió una respuesta no esperada.',
        status: response.status,
        retryable: response.status >= 500 || response.status === 429,
      })
    }

    if (isRecord(payload) && 'data' in payload && 'meta' in payload) {
      return payload as unknown as ApiSuccess<T>
    }
    return { data: payload as T, meta: {} }
  } catch (error) {
    throw new ApiClientError(normalizeError(error))
  } finally {
    window.clearTimeout(timeout)
  }
}

export const apiClient = {
  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return (await requestEnvelope<T>(`${appConfig.apiBaseUrl}${path}`, { ...options, method: 'GET' })).data
  },
  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return (await requestEnvelope<T>(`${appConfig.apiBaseUrl}${path}`, { ...options, method: 'POST', body })).data
  },
  async patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return (await requestEnvelope<T>(`${appConfig.apiBaseUrl}${path}`, { ...options, method: 'PATCH', body })).data
  },
  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return (await requestEnvelope<T>(`${appConfig.apiBaseUrl}${path}`, { ...options, method: 'DELETE' })).data
  },
  async health(): Promise<boolean> {
    try {
      await requestEnvelope<{ status: string }>(appConfig.apiHealthUrl, { method: 'GET', timeoutMs: 3_000 })
      return true
    } catch {
      return false
    }
  },
}
