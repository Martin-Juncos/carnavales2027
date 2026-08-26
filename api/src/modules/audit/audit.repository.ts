import type { PoolClient } from 'pg'
import { query, type DatabaseClient } from '../../database/pool'
import type { Role } from '../auth/auth.types'

export interface AuditInput {
  actorUserId?: string | undefined
  actorRole?: Role | undefined
  action: string
  entity: string
  entityId?: string | undefined
  requestId?: string | undefined
  operationUuid?: string | undefined
  metadata?: Record<string, unknown> | undefined
  ip?: string | undefined
  deviceId?: string | undefined
}

export async function writeAudit(input: AuditInput, client?: PoolClient): Promise<void> {
  const database: DatabaseClient | undefined = client
  await query(
    `INSERT INTO audit_log (
      actor_user_id, actor_role, accion, entidad, entidad_id, request_id,
      operation_uuid, metadata, ip, device_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      input.actorUserId ?? null,
      input.actorRole ?? null,
      input.action,
      input.entity,
      input.entityId ?? null,
      input.requestId ?? null,
      input.operationUuid ?? null,
      input.metadata ?? {},
      input.ip ?? null,
      input.deviceId ?? null,
    ],
    database,
  )
}
