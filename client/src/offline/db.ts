import Dexie, { type Table } from 'dexie'
import type {
  ComparsaCloseDraft,
  DeviceRecord,
  ReferenceDataRecord,
  SessionSnapshot,
  SyncMetadata,
  SyncOperation,
  VoteDraft,
} from '../types/domain'

export class CarnavalesDatabase extends Dexie {
  sessionSnapshots!: Table<SessionSnapshot, string>
  referenceData!: Table<ReferenceDataRecord, string>
  voteDrafts!: Table<VoteDraft, string>
  comparsaCloseDrafts!: Table<ComparsaCloseDraft, string>
  syncOperations!: Table<SyncOperation, string>
  syncMetadata!: Table<SyncMetadata, string>
  device!: Table<DeviceRecord, string>

  constructor() {
    super('carnavales2027-client')
    this.version(1).stores({
      sessionSnapshots: 'id,capturedAt,user.role',
      referenceData: 'key,updatedAt,version',
      voteDrafts: 'id,operationId,comparsaId,itemId,syncStatus',
      comparsaCloseDrafts: 'id,operationId,comparsaId,syncStatus',
      syncOperations: 'operationId,type,status,createdAt,nextAttemptAt',
      syncMetadata: 'key,updatedAt',
      device: 'id,deviceId',
    })
  }
}

export const db = new CarnavalesDatabase()

export const SYNC_EVENT_NAME = 'carnavales-sync-updated'

export function notifySyncSubscribers(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT_NAME))
  }
}

export async function resetClientDatabaseForTests(): Promise<void> {
  await db.delete()
  await db.open()
  notifySyncSubscribers()
}
