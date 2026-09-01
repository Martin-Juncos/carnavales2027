export type Role = 'jurado' | 'fiscal' | 'escribano' | 'admin'
export type NightStatus = 'draft' | 'open' | 'closed' | 'certified'

export interface AuthenticatedUser {
  id: string
  nombre: string
  email: string
  role: Role
  sessionId: string
}

export interface NightSummary {
  id: number
  name: string
  status: NightStatus
  fecha: string
}

export interface JurorAssignmentContext {
  id: string
  night: NightSummary
}

export interface Comparsa {
  id: number
  nombre: string
  orden: number
  nocheId?: number
  nocheNombre?: string
  activo?: boolean
}

export interface ScoringItem {
  id: number
  nombre: string
  parentItemId: number | null
  orden: number
  activo?: boolean
}

export interface ServerVote {
  id: string
  operationUuid: string
  comparsaId: number
  itemId: number
  valor: number
  clientCreatedAt?: string
  serverReceivedAt: string
}

export interface ServerComparsaClose {
  id: string
  operationUuid: string
  comparsaId: number
  clientCreatedAt?: string
  serverReceivedAt: string
}

export interface JuradoContext {
  assignment: JurorAssignmentContext
  comparsas: Comparsa[]
  items: ScoringItem[]
  votes: ServerVote[]
  closes: ServerComparsaClose[]
}

export type VoteSyncStatus = 'LOCAL' | 'PENDING' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'REJECTED'
export type SyncOperationType = 'vote' | 'close_comparsa'
export type SyncResultStatus = 'APPLIED' | 'ALREADY_APPLIED' | 'REJECTED' | 'CONFLICT'

export interface VoteOperationPayload {
  comparsaId: number
  itemId: number
  valor: number
  clientCreatedAt: string
}

export interface CloseComparsaOperationPayload {
  comparsaId: number
  clientCreatedAt: string
}

export type SyncOperationPayload = VoteOperationPayload | CloseComparsaOperationPayload

export interface SyncOperation {
  operationId: string
  type: SyncOperationType
  payload: SyncOperationPayload
  createdAt: string
  status: VoteSyncStatus
  attempts: number
  lastError?: string
  lastErrorCode?: string
  lastAttemptAt?: string
  nextAttemptAt?: string
  serverResourceId?: string
  resultStatus?: SyncResultStatus
}

export interface VoteDraft {
  id: string
  operationId: string
  comparsaId: number
  itemId: number
  valor: number
  syncStatus: VoteSyncStatus
  confirmedAt: string
  serverReceivedAt?: string
  lastError?: string
}

export interface ComparsaCloseDraft {
  id: string
  operationId: string
  comparsaId: number
  syncStatus: VoteSyncStatus
  confirmedAt: string
  serverReceivedAt?: string
  lastError?: string
}

export interface SessionSnapshot {
  id: string
  user: AuthenticatedUser
  expiresAt?: string
  capturedAt: string
}

export interface ReferenceDataRecord<T = unknown> {
  key: string
  value: T
  updatedAt: string
  version?: string
}

export interface SyncMetadata {
  key: string
  value: string
  updatedAt: string
}

export interface DeviceRecord {
  id: string
  deviceId: string
  createdAt: string
}

export interface JurorNightProgress {
  comparsaId: number
  totalScorable: number
  confirmed: number
  synced: number
  pending: number
  conflicted: number
  closed: boolean
  closeStatus?: VoteSyncStatus
}

export interface SupervisionNightState {
  night: { id: number; nombre: string; fecha: string; estado: NightStatus } | null
  progress: Array<{ comparsaId: number; comparsaNombre: string; votesReceived: number; jurorCloses: number }>
}

export interface FiscalEvent {
  id: number
  tipo: string
  juradoId?: string
  comparsaId?: number
  nocheId?: number
  payload: Record<string, unknown>
  createdAt: string
}

export interface ReportRow {
  nocheId?: number
  nocheNombre?: string
  comparsaId: number
  comparsaNombre: string
  itemId?: number
  itemNombre?: string
  parentItemId?: number | null
  valor?: number
  grossTotal?: number
  penaltyTotal?: number
  finalTotal?: number
  serverReceivedAt?: string
}

export interface AuditRow {
  id: number
  actorUserId?: string
  actorRole?: Role
  accion: string
  entidad: string
  entityId?: string
  requestId?: string
  operationUuid?: string
  metadata: Record<string, unknown>
  createdAt: string
}
