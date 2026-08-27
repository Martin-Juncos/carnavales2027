import { appConfig } from '../app/config/env'
import { juradoApi, type ReconcileRequestOperation, type ReconcileResult } from '../api/juradoApi'
import { ApiClientError, normalizeError } from '../api/apiClient'
import type { SyncOperation, VoteSyncStatus } from '../types/domain'
import { getDeviceId } from './device'
import {
  markLastSync,
  markOperationsPendingAfterTransportFailure,
  markOperationsSyncing,
  readyOperations,
  updateOperationStatus,
} from './syncRepository'
import { db, notifySyncSubscribers } from './db'

let inFlight = false

function resourceId(resource: Record<string, unknown> | undefined): string | undefined {
  if (!resource) return undefined
  const serverReceivedAt = resource.serverReceivedAt
  if (typeof serverReceivedAt === 'string') return serverReceivedAt
  const id = resource.id
  return typeof id === 'string' ? id : undefined
}

function finalStatus(result: ReconcileResult): VoteSyncStatus {
  if (result.status === 'APPLIED' || result.status === 'ALREADY_APPLIED') return 'SYNCED'
  if (result.status === 'CONFLICT') return 'CONFLICT'
  return 'REJECTED'
}

function errorMessage(result: ReconcileResult): string | undefined {
  return result.error?.message
}

function operationForResult(operations: SyncOperation[], result: ReconcileResult): SyncOperation | undefined {
  return operations.find((operation) => operation.operationId === result.operationId)
}

function toRequestOperation(operation: SyncOperation): ReconcileRequestOperation {
  return {
    operationId: operation.operationId,
    type: operation.type,
    payload: operation.payload,
  }
}

async function applyResults(operations: SyncOperation[], results: ReconcileResult[]): Promise<void> {
  await db.transaction('rw', db.syncOperations, db.voteDrafts, db.comparsaCloseDrafts, db.syncMetadata, async () => {
    for (const result of results) {
      const operation = operationForResult(operations, result)
      if (!operation) continue
      const status = finalStatus(result)
      const message = errorMessage(result)
      const code = result.error?.code
      const serverId = resourceId(result.resource)
      await updateOperationStatus(operation, status, {
        resultStatus: result.status,
        ...(message ? { lastError: message } : {}),
        ...(code ? { lastErrorCode: code } : {}),
        ...(serverId ? { serverResourceId: serverId } : {}),
      })
    }
  })
}

export async function processSyncQueue(options: { force?: boolean } = {}): Promise<void> {
  if (inFlight) return
  const operations = await readyOperations(appConfig.syncBatchSize, options.force ?? false)
  if (operations.length === 0) return

  inFlight = true
  await markOperationsSyncing(operations)
  try {
    const deviceId = await getDeviceId()
    const response = await juradoApi.reconcile(deviceId, operations.map(toRequestOperation))
    await applyResults(operations, response.operations)
    await markLastSync()
  } catch (error) {
    const normalized = normalizeError(error)
    if (error instanceof ApiClientError && (error.code === 'AUTH_REQUIRED' || error.code === 'SESSION_EXPIRED')) {
      await markOperationsPendingAfterTransportFailure(operations, 'La sesión debe renovarse antes de sincronizar.', error.code)
    } else {
      await markOperationsPendingAfterTransportFailure(operations, normalized.message, normalized.code)
    }
  } finally {
    inFlight = false
    notifySyncSubscribers()
  }
}

export function scheduleSync(delayMs = 0, force = false): void {
  window.setTimeout(() => {
    void processSyncQueue({ force })
  }, delayMs)
}

export function startSyncRuntime(): () => void {
  const onOnline = (): void => scheduleSync(250, true)
  const onFocus = (): void => scheduleSync(250, true)
  window.addEventListener('online', onOnline)
  window.addEventListener('focus', onFocus)
  const interval = window.setInterval(() => {
    void processSyncQueue()
  }, 30_000)
  scheduleSync(1_000)
  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('focus', onFocus)
    window.clearInterval(interval)
  }
}
