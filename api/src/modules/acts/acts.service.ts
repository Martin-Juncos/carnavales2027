import { randomUUID } from 'node:crypto'
import PDFDocument from 'pdfkit'
import { query, withTransaction } from '../../database/pool'
import { errors } from '../../shared/errors/app-error'
import { sha256 } from '../../shared/security/crypto'
import { writeAudit } from '../audit/audit.repository'
import type { AuthenticatedUser } from '../auth/auth.types'
import { reportByNight } from '../scoring/scoring.repository'
import { FileSystemDocumentStorage, type DocumentStorage } from './document-storage'

interface Context { requestId: string; ip?: string }
type ActType = 'pdf' | 'csv'
type ReportRow = Record<string, unknown>

function csvValue(value: unknown): string {
  const text = value == null
    ? ''
    : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint'
      ? String(value)
      : value instanceof Date
        ? value.toISOString()
        : JSON.stringify(value)
  return `"${text.replaceAll('"', '""')}"`
}

function createCsv(nightId: number, rows: ReportRow[], generatedAt: string): Buffer {
  const header = ['nightId', 'generatedAt', 'comparsaId', 'comparsaNombre', 'grossTotal', 'penaltyTotal', 'finalTotal']
  const lines = [header.map(csvValue).join(',')]
  for (const row of rows) {
    lines.push([
      nightId,
      generatedAt,
      row.comparsaId,
      row.comparsaNombre,
      row.grossTotal,
      row.penaltyTotal,
      row.finalTotal,
    ].map(csvValue).join(','))
  }
  return Buffer.from(`${lines.join('\n')}\n`, 'utf8')
}

function createPdf(nightId: number, rows: ReportRow[], generatedAt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: 50, info: { Title: `Acta Noche ${nightId}` } })
    const chunks: Buffer[] = []
    document.on('data', (chunk: Buffer) => chunks.push(chunk))
    document.on('error', reject)
    document.on('end', () => { resolve(Buffer.concat(chunks)); })
    document.fontSize(18).text(`Carnavales 2027 - Acta Noche ${nightId}`)
    document.moveDown().fontSize(10).text(`Generada: ${generatedAt}`)
    document.moveDown()
    for (const row of rows) {
      document.text(
        `${String(row.comparsaNombre)} | bruto ${String(row.grossTotal)} | penalizaciones ${String(row.penaltyTotal)} | final ${String(row.finalTotal)}`,
      )
    }
    document.end()
  })
}

export class ActsService {
  constructor(private readonly storage: DocumentStorage = new FileSystemDocumentStorage()) {}

  async list(input: { nocheId?: number; limit: number }) {
    const result = await query(
      `SELECT id, noche_id AS "nocheId", tipo, version, sha256, byte_size AS "byteSize", estado,
              generada_at AS "generadaAt", certificada_por AS "certificadaPor", certificada_at AS "certificadaAt"
       FROM actas
       WHERE ($1::bigint IS NULL OR noche_id = $1)
       ORDER BY generada_at DESC
       LIMIT $2`,
      [input.nocheId ?? null, input.limit],
    )
    return result.rows
  }

  async generate(actor: AuthenticatedUser, nightId: number, type: ActType, context: Context) {
    let storedKey: string | undefined
    try {
      return await withTransaction(async (client) => {
        await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
        const night = await query<{ id: string; nombre: string; estado: string }>(
          'SELECT id, nombre, estado FROM noches WHERE id = $1 FOR SHARE',
          [nightId],
          client,
        )
        if (!night.rows[0]) throw errors.notFound('Noche')
        await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [nightId])
        const versionResult = await query<{ version: number }>(
          'SELECT COALESCE(MAX(version), 0)::int + 1 AS version FROM actas WHERE noche_id = $1 AND tipo = $2',
          [nightId, type],
          client,
        )
        const version = versionResult.rows[0]?.version ?? 1
        const rows = await reportByNight(nightId, client) as ReportRow[]
        const generatedAt = new Date().toISOString()
        const content = type === 'csv'
          ? createCsv(nightId, rows, generatedAt)
          : await createPdf(nightId, rows, generatedAt)
        const id = randomUUID()
        const key = `${nightId}/${type}/v${version}-${id}.${type}`
        await this.storage.put(key, content)
        storedKey = key
        const digest = sha256(content)
        const result = await query(
          `INSERT INTO actas (id, noche_id, tipo, version, storage_key, sha256, byte_size, generada_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING id, noche_id AS "nocheId", tipo, version, sha256, byte_size AS "byteSize",
                     estado, generada_at AS "generadaAt"`,
          [id, nightId, type, version, key, digest, content.length, actor.id],
          client,
        )
        await writeAudit({
          actorUserId: actor.id, actorRole: actor.role, action: 'act.generated', entity: 'actas', entityId: id,
          requestId: context.requestId, ip: context.ip, metadata: { nightId, type, version, sha256: digest },
        }, client)
        return result.rows[0]
      })
    } catch (error) {
      if (storedKey) await this.storage.remove(storedKey)
      throw error
    }
  }

  async get(id: string) {
    const result = await query(
      `SELECT id, noche_id AS "nocheId", tipo, version, sha256, byte_size AS "byteSize", estado,
              generada_at AS "generadaAt", certificada_por AS "certificadaPor", certificada_at AS "certificadaAt"
       FROM actas WHERE id = $1`,
      [id],
    )
    const act = result.rows[0]
    if (!act) throw errors.notFound('Acta')
    return act
  }

  async certify(actor: AuthenticatedUser, id: string, context: Context) {
    return withTransaction(async (client) => {
      const result = await query(
        `UPDATE actas SET estado = 'certified', certificada_por = $2, certificada_at = now()
         WHERE id = $1 AND estado = 'generated'
         RETURNING id, noche_id AS "nocheId", tipo, version, sha256, estado, certificada_at AS "certificadaAt"`,
        [id, actor.id],
        client,
      )
      const act = result.rows[0]
      if (!act) throw errors.conflict('IDEMPOTENCY_CONFLICT', 'El acta no existe o ya fue certificada.')
      await writeAudit({
        actorUserId: actor.id, actorRole: actor.role, action: 'act.certified', entity: 'actas', entityId: id,
        requestId: context.requestId, ip: context.ip, metadata: { sha256: act.sha256 },
      }, client)
      return act
    })
  }

  async verify(id: string) {
    const result = await query<{ id: string; storage_key: string; sha256: string }>(
      'SELECT id, storage_key, sha256 FROM actas WHERE id = $1',
      [id],
    )
    const act = result.rows[0]
    if (!act) throw errors.notFound('Acta')
    const actual = sha256(await this.storage.get(act.storage_key))
    return { id: act.id, expectedSha256: act.sha256, actualSha256: actual, valid: actual === act.sha256 }
  }
}
