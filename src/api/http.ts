import axios, { AxiosError } from 'axios'
import type { ApiErrorBody, ApiErrorCode } from '@/contracts/api'
import { mocksReady } from '@/lib/mocks-ready'
import { emitSessionExpired, getGuestCartId, sessionStore } from '@/session/session-store'

/** Normalised error thrown by every API call. */
export class ApiError extends Error {
  status: number
  code: ApiErrorCode | 'NETWORK' | 'TIMEOUT' | 'CANCELED'
  fields?: Record<string, string>
  details?: unknown

  constructor(status: number, code: ApiError['code'], message: string, fields?: Record<string, string>, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
    this.details = details
  }

  /** errors worth retrying automatically (never 4xx business errors) */
  get isTransient() {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT' || this.code === 'TRANSIENT' || this.status === 503
  }
}

export const http = axios.create({
  baseURL: '/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use(async (config) => {
  await mocksReady()
  const { token } = sessionStore.get()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  config.headers.set('X-Guest-Cart-Id', getGuestCartId())
  return config
})

http.interceptors.response.use(
  (r) => r,
  (error: AxiosError<ApiErrorBody>) => {
    if (axios.isCancel(error)) throw new ApiError(0, 'CANCELED', 'Requisição cancelada.')
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new ApiError(0, 'TIMEOUT', 'O servidor demorou demais para responder.')
    }
    const res = error.response
    if (!res) throw new ApiError(0, 'NETWORK', 'Sem conexão com o servidor. Verifique sua internet.')
    const body = res.data?.error
    const apiError = new ApiError(
      res.status,
      body?.code ?? (res.status >= 500 ? 'INTERNAL' : 'VALIDATION_ERROR'),
      body?.message ?? 'Algo deu errado.',
      body?.fields,
      body?.details,
    )
    const sentToken = String(error.config?.headers?.Authorization ?? '').replace('Bearer ', '')
    if (
      res.status === 401 &&
      (apiError.code === 'SESSION_EXPIRED' || apiError.code === 'UNAUTHENTICATED') &&
      sentToken &&
      sentToken === sessionStore.get().token
    ) {
      emitSessionExpired()
    }
    throw apiError
  },
)

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}
