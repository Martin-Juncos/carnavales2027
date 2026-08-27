export interface ApiSuccess<T> {
  data: T
  meta: Record<string, unknown>
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_OTP'
  | 'OTP_EXPIRED'
  | 'OTP_ALREADY_USED'
  | 'OTP_ATTEMPTS_EXCEEDED'
  | 'OTP_DELIVERY_UNAVAILABLE'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'JUDGE_CAPACITY_EXCEEDED'
  | 'JUROR_NOT_ASSIGNED'
  | 'ASSIGNMENT_INACTIVE'
  | 'NIGHT_CLOSED'
  | 'COMPARSA_CLOSED'
  | 'COMPARSA_INCOMPLETE'
  | 'ITEM_NOT_SCORABLE'
  | 'INVALID_SCORE'
  | 'VOTE_ALREADY_CONFIRMED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'SYNC_REVIEW_REQUIRED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN_ERROR'

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    requestId?: string
    retryable?: boolean
    details?: unknown
  }
}

export interface NormalizedApiError {
  code: string
  message: string
  status: number
  retryable: boolean
  requestId?: string | undefined
  details?: unknown
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  timeoutMs?: number
}
