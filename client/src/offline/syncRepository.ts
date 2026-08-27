import { db, notifySyncSubscribers } from './db'
import { newOperationId } from './device'
import type {
  AuthenticatedUser,
  ComparsaCloseDraft,
  JuradoContext,
  ReferenceDataRecord,
  SessionSnapshot,
  SyncOperation,
  SyncOperationType,
  VoteDraft,
  VoteSyncStatus,
} from '../types/domain'

const JURADO_CONTEXT_KEY = 'jurado-context'

export function voteDraftId(comparsaId: number, itemId: number): string {
  return `${comparsaId}:${itemId}`
}

export function closeDraftId(comparsaId: number): string {
  return `close:${comparsaId}`
}

export async function saveSessionSnapshot(user: AuthenticatedUser, expiresAt?: string): Promise<void> {
  const snapshot: SessionSnapshot = {
    id: 'current',
    user,
    capturedAt: new Date().toISOString(),
    ...(expiresAt ? { expiresAt } : {}),
  }
  await db.sessionSnapshots.put(snapshot)
}

export async function clearSessionSnapshot(): Promise<void> {
  await db.sessionSnapshots.delete('current')
}

export async function getSessionSnapshot(): Promise<SessionSnapshot | undefined> {
  return db.sessionSnapshots.get('current')
}

export async function saveReferenceData(key: string, value: unknown, version?: string): Promise<void> {
  const record: ReferenceDataRecord = {
    key,
    value,
    updatedAt: new Date().toISOString(),
    ...(version ? { version } : {}),
  }
  await db.referenceData.put(record)
}

export async function saveJuradoContextCache(context: JuradoContext): Promise<void> {
  await saveReferenceData(JURADO_CONTEXT_KEY, context, context.assignment.night.status)
}

export async function getJuradoContextCache(): Promise<JuradoContext | undefined> {
  const record = await db.referenceData.get(JURADO_CONTEXT_KEY)
  return record?.value as JuradoContext | undefined
}

export interface EnqueueVoteInput {
  comparsaId: number
  itemId: number
  valor: number
}

export interface EnqueueCloseInput {
  comparsaId: number
}

export async function enqueueVoteOperation(input: EnqueueVoteInput): Promise<VoteDraft> {
  const operationId = newOperationId()
  const now = new Date().toISOString()
  const draft: VoteDraft = {
    id: voteDraftId(input.comparsaId, input.itemId),
    operationId,
    comparsaId: input.comparsaId,
    itemId: input.itemId,
    valor: input.valor,
    syncStatus: 'PENDING',
    confirmedAt: now,
  }
  const operation: SyncOperation = {
    operationId,
    type: 'vote',
    payload: { comparsaId: input.comparsaId, itemId: input.itemId, valor: input.valor, clientCreatedAt: now },
    createdAt: now,
    status: 'PENDING',
    attempts: 0,
  }
  await db.transaction('rw', db.voteDrafts, db.syncOperations, async () => {
    await db.voteDrafts.put(draft)
    await db.syncOperations.put(operation)
  })
  notifySyncSubscribers()
  return draft
}

export async function enqueueCloseComparsaOperation(input: EnqueueCloseInput): Promise<ComparsaCloseDraft> {
  const operationId = newOperationId()
  const now = new Date().toISOString()
  const draft: ComparsaCloseDraft = {
    id: closeDraftId(input.comparsaId),
    operationId,
    comparsaId: input.comparsaId,
    syncStatus: 'PENDING',
    confirmedAt: now,
  }
  const operation: SyncOperation = {
    operationId,
    type: 'close_comparsa',
    payload: { comparsaId: input.comparsaId, clientCreatedAt: now },
    createdAt: now,
    status: 'PENDING',
    attempts: 0,
  }
  await db.transaction('rw', db.comparsaCloseDrafts, db.syncOperations, async () => {
    await db.comparsaCloseDrafts.put(draft)
    await db.syncOperations.put(operation)
  })
  notifySyncSubscribers()
  return draft
}

export async function getVoteDrafts(): Promise<VoteDraft[]> {
  return db.voteDrafts.toArray()
}

export async function getCloseDrafts(): Promise<ComparsaCloseDraft[]> {
  return db.comparsaCloseDrafts.toArray()
}

export async function getOperationsByStatus(statuses: VoteSyncStatus[]): Promise<SyncOperation[]> {
  const operations = await db.syncOperations.toArray()
  const allowed = new Set(statuses)
  return operations.filter((operation) => allowed.has(operation.status))
}

export interface SyncSummary {
  pending: number
  syncing: number
  synced: number
  conflicts: number
  rejected: number
  lastSyncAt?: string
  lastError?: string
}

export async function getSyncSummary(): Promise<SyncSummary> {
  const [operations, lastSync, lastError] = await Promise.all([
    db.syncOperations.toArray(),
    db.syncMetadata.get('lastSyncAt'),
    db.syncMetadata.get('lastError'),
  ])
  return {
    pending: operations.filter((operation) => operation.status === 'PENDING' || operation.status === 'LOCAL').length,
    syncing: operations.filter((operation) => operation.status === 'SYNCING').length,
    synced: operations.filter((operation) => operation.status === 'SYNCED').length,
    conflicts: operations.filter((operation) => operation.status === 'CONFLICT').length,
    rejected: operations.filter((operation) => operation.status === 'REJECTED').length,
    ...(lastSync ? { lastSyncAt: lastSync.value } : {}),
    ...(lastError ? { lastError: lastError.value } : {}),
  }
}

export async function markOperationsSyncing(operations: SyncOperation[]): Promise<void> {
  const now = new Date().toISOString()
  await db.transaction('rw', db.syncOperations, db.voteDrafts, db.comparsaCloseDrafts, async () => {
    for (const operation of operations) {
      await updateOperationStatus(operation, 'SYNCING', { lastAttemptAt: now, attempts: operation.attempts + 1 })
    }
  })
  notifySyncSubscribers()
}

function nextRetryAt(attempts: number, now = Date.now()): string {
  const delayMs = Math.min(60_000, 1_000 * 2 ** Math.min(attempts, 6))
  return new Date(now + delayMs).toISOString()
}

export async function markOperationsPendingAfterTransportFailure(operations: SyncOperation[], message: string, code = 'NETWORK_ERROR'): Promise<void> {
  await db.transaction('rw', db.syncOperations, db.voteDrafts, db.comparsaCloseDrafts, db.syncMetadata, async () => {
    for (const operation of operations) {
      await updateOperationStatus(operation, 'PENDING', {
        lastError: message,
        lastErrorCode: code,
        nextAttemptAt: nextRetryAt(Math.max(operation.attempts, 1)),
      })
    }
    await db.syncMetadata.put({ key: 'lastError', value: message, updatedAt: new Date().toISOString() })
  })
  notifySyncSubscribers()
}

export async function updateOperationStatus(
  operation: SyncOperation,
  status: VoteSyncStatus,
  patch: Partial<Omit<SyncOperation, 'operationId' | 'type' | 'payload' | 'createdAt' | 'status'>> = {},
): Promise<void> {
  const next: SyncOperation = { ...operation, ...patch, status }
  await db.syncOperations.put(next)

  if (operation.type === 'vote') {
    const payload = operation.payload
    if ('itemId' in payload) {
      const draft = await db.voteDrafts.get(voteDraftId(payload.comparsaId, payload.itemId))
      if (draft) {
        const nextDraft: VoteDraft = {
          ...draft,
          syncStatus: status,
          ...(patch.lastError ? { lastError: patch.lastError } : {}),
          ...(patch.serverResourceId ? { serverReceivedAt: patch.serverResourceId } : {}),
        }
        await db.voteDrafts.put(nextDraft)
      }
    }
  } else {
    const payload = operation.payload
    if ('comparsaId' in payload) {
      const draft = await db.comparsaCloseDrafts.get(closeDraftId(payload.comparsaId))
      if (draft) {
        const nextDraft: ComparsaCloseDraft = {
          ...draft,
          syncStatus: status,
          ...(patch.lastError ? { lastError: patch.lastError } : {}),
          ...(patch.serverResourceId ? { serverReceivedAt: patch.serverResourceId } : {}),
        }
        await db.comparsaCloseDrafts.put(nextDraft)
      }
    }
  }
}

export async function markLastSync(): Promise<void> {
  const now = new Date().toISOString()
  await db.syncMetadata.put({ key: 'lastSyncAt', value: now, updatedAt: now })
  await db.syncMetadata.delete('lastError')
  notifySyncSubscribers()
}

export async function readyOperations(limit: number, force = false): Promise<SyncOperation[]> {
  const now = new Date().toISOString()
  const operations = (await db.syncOperations.toArray())
    .filter((operation) => operation.status === 'PENDING' || operation.status === 'LOCAL')
    .filter((operation) => force || !operation.nextAttemptAt || operation.nextAttemptAt <= now)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))

  const syncedVoteKeys = new Set(
    (await db.voteDrafts.toArray())
      .filter((draft) => draft.syncStatus === 'SYNCED')
      .map((draft) => voteDraftId(draft.comparsaId, draft.itemId)),
  )

  const ready: SyncOperation[] = []
  for (const operation of operations) {
    if (operation.type === 'close_comparsa') {
      const payload = operation.payload
      const votesForComparsa = (await db.voteDrafts.where('comparsaId').equals(payload.comparsaId).toArray())
      const allVotesSynced = votesForComparsa.every((draft) => syncedVoteKeys.has(voteDraftId(draft.comparsaId, draft.itemId)))
      if (!allVotesSynced) continue
    }
    ready.push(operation)
    if (ready.length >= limit) break
  }
  return ready
}

export function operationStatusLabel(status: VoteSyncStatus): string {
  const labels: Record<VoteSyncStatus, string> = {
    LOCAL: 'Guardado local',
    PENDING: 'Pendiente de sincronizar',
    SYNCING: 'Sincronizando',
    SYNCED: 'Confirmado por servidor',
    CONFLICT: 'Conflicto',
    REJECTED: 'Rechazado',
  }
  return labels[status]
}

export function operationTypeLabel(type: SyncOperationType): string {
  return type === 'vote' ? 'Voto' : 'Cierre de comparsa'
}
