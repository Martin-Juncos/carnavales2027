export type ErrorCode =
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

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
    public readonly retryable = false,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const errors = {
  validation: (details?: unknown) => new AppError('VALIDATION_ERROR', 'La solicitud no es válida.', 400, details),
  authRequired: () => new AppError('AUTH_REQUIRED', 'Autenticación requerida.', 401),
  forbidden: () => new AppError('FORBIDDEN', 'No tiene permisos para realizar esta operación.', 403),
  notFound: (resource = 'Recurso') => new AppError('RESOURCE_NOT_FOUND', `${resource} no encontrado.`, 404),
  conflict: (code: ErrorCode, message: string, details?: unknown) => new AppError(code, message, 409, details),
  domain: (code: ErrorCode, message: string, status = 422, details?: unknown) =>
    new AppError(code, message, status, details),
} as const
