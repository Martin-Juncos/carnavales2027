import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import argon2 from 'argon2'
import { Pool, type PoolClient } from 'pg'

const apiRoot = process.cwd()
const projectRoot = path.resolve(apiRoot, '..')
const clientRoot = path.join(projectRoot, 'client')
const mailpitApi = 'http://127.0.0.1:8025'
const password = 'Carnavales-System-2027!'
const runId = randomUUID().replaceAll('-', '').slice(0, 12)
const schema = `carnavales_system_${runId}`

interface Fixture {
  schema: string
  password: string
  users: Record<'admin' | 'fiscal' | 'escribano' | 'jurado', { dni: string; email: string; id: string; nombre: string }>
  nightId: number
  comparsaId: number
  itemNames: string[]
}

function firstRow<T>(rows: T[], label: string): T {
  const row = rows[0]
  if (!row) throw new Error(`${label}: no devolvió filas.`)
  return row
}

function requiredAt<T>(values: T[], index: number, label: string): T {
  const value = values[index]
  if (!value) throw new Error(`${label}: falta índice ${index}.`)
  return value
}

function requireTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL
  if (!value) throw new Error('TEST_DATABASE_URL es obligatoria para test:system.')
  const url = new URL(value)
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!database.endsWith('_test')) {
    throw new Error(`Test de sistema rechazado: la base "${database}" no termina en _test.`)
  }
  return value
}

function scopedDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl)
  url.searchParams.set('options', `-c search_path=${schema},public`)
  return url.toString()
}

async function assertMailpit(): Promise<void> {
  try {
    const response = await fetch(`${mailpitApi}/api/v1/messages`, { signal: AbortSignal.timeout(3_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  } catch (error) {
    throw new Error(
      'Mailpit no está disponible en 127.0.0.1:8025. Ejecutá "docker compose up -d postgres mailpit" desde api antes de test:system.',
      { cause: error },
    )
  }
}

async function initializeFixture(client: PoolClient): Promise<Fixture> {
  await client.query(`CREATE SCHEMA "${schema}"`)
  await client.query(`SET search_path TO "${schema}", public`)
  const migration = await readFile(path.join(apiRoot, 'migrations', '001_initial.up.sql'), 'utf8')
  await client.query('BEGIN')
  try {
    await client.query(migration)
    await client.query(`
      CREATE TABLE schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await client.query("INSERT INTO schema_migrations(version) VALUES ('001_initial')")

    const passwordHash = await argon2.hash(password)
    const actors = [
      { key: 'admin', nombre: 'Administración Sistema', dni: '90000001', role: 'admin' },
      { key: 'fiscal', nombre: 'Fiscal Sistema', dni: '90000002', role: 'fiscal' },
      { key: 'escribano', nombre: 'Escribano Sistema', dni: '90000003', role: 'escribano' },
    ] as const
    const users = {} as Fixture['users']
    for (const actor of actors) {
      const email = `${actor.key}.${runId}@example.test`
      const result = await client.query<{ id: string }>(
        `INSERT INTO users(nombre, dni, email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [actor.nombre, actor.dni, email, passwordHash, actor.role],
      )
      users[actor.key] = { dni: actor.dni, email, id: firstRow(result.rows, `user ${actor.key}`).id, nombre: actor.nombre }
    }

    const jurors: Array<{ id: string; email: string }> = []
    for (let index = 1; index <= 9; index += 1) {
      const email = `jurado${index}.${runId}@example.test`
      const result = await client.query<{ id: string }>(
        `INSERT INTO users(nombre, dni, email, password_hash, role)
         VALUES ($1, $2, $3, $4, 'jurado') RETURNING id`,
        [`Jurado ${index}`, `9100000${index}`, email, passwordHash],
      )
      jurors.push({ id: firstRow(result.rows, `jurado ${index}`).id, email })
    }
    users.jurado = { ...requiredAt(jurors, 0, 'jurados'), dni: '91000001', nombre: 'Jurado 1' }

    const nights: number[] = []
    for (let index = 1; index <= 3; index += 1) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO noches(nombre, fecha, estado)
         VALUES ($1, $2, 'open') RETURNING id`,
        [`Noche ${index}`, `2027-02-0${index + 5}`],
      )
      nights.push(Number(firstRow(result.rows, `noche ${index}`).id))
    }
    for (let index = 0; index < jurors.length; index += 1) {
      await client.query(
        `INSERT INTO jurado_asignaciones(jurado_id, noche_id, asignado_por)
         VALUES ($1, $2, $3)`,
        [requiredAt(jurors, index, 'jurados').id, requiredAt(nights, Math.floor(index / 3), 'noches'), users.admin.id],
      )
    }

    const comparsas: number[] = []
    for (let index = 0; index < nights.length; index += 1) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO comparsas(nombre, noche_id, orden)
         VALUES ($1, $2, 1) RETURNING id`,
        [requiredAt(["Ará Berá", 'Imperio', 'Sapucay'], index, 'nombres de comparsas'), requiredAt(nights, index, 'noches')],
      )
      comparsas.push(Number(firstRow(result.rows, `comparsa ${index}`).id))
    }

    const parent = await client.query<{ id: string }>(
      "INSERT INTO items(nombre, orden) VALUES ('Presentación', 1) RETURNING id",
    )
    const parentId = Number(firstRow(parent.rows, 'item padre').id)
    for (const [name, order] of [['Diseño', 1], ['Terminación', 2]] as const) {
      await client.query('INSERT INTO items(nombre, parent_item_id, orden) VALUES ($1, $2, $3)', [name, parentId, order])
    }
    await client.query("INSERT INTO items(nombre, orden) VALUES ('Música', 2)")
    await client.query('COMMIT')

    return {
      schema,
      password,
      users,
      nightId: requiredAt(nights, 0, 'noches'),
      comparsaId: requiredAt(comparsas, 0, 'comparsas'),
      itemNames: ['Diseño', 'Terminación', 'Música'],
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

function startNode(script: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn(process.execPath, [script, ...args], { cwd, env, stdio: 'inherit', windowsHide: true })
  child.once('exit', (code) => {
    if (code && code !== 0) console.error(`Proceso ${path.basename(script)} finalizó con código ${code}.`)
  })
  return child
}

async function runNode(script: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = startNode(script, args, cwd, env)
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${path.basename(script)} terminó con código ${String(code)}.`))
    })
  })
}

async function waitForUrl(url: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`El proceso requerido terminó antes de responder en ${url}.`)
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_500) })
      if (response.ok) return
    } catch {
      // El proceso todavía está iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`Timeout esperando ${url}.`)
}

async function stop(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  const exited = await Promise.race([
    new Promise<boolean>((resolve) => {
      child.once('exit', () => {
        resolve(true)
      })
    }),
    new Promise<boolean>((resolve) => {
      setTimeout(() => {
        resolve(false)
      }, 5_000)
    }),
  ])
  if (!exited) child.kill('SIGKILL')
}

async function main(): Promise<void> {
  const testDatabaseUrl = requireTestDatabaseUrl()
  await assertMailpit()
  const adminPool = new Pool({ connectionString: testDatabaseUrl, max: 1 })
  const client = await adminPool.connect()
  const actStorage = await mkdtemp(path.join(tmpdir(), 'carnavales-actas-'))
  let api: ChildProcess | undefined
  let preview: ChildProcess | undefined
  try {
    const fixture = await initializeFixture(client)
    const databaseUrl = scopedDatabaseUrl(testDatabaseUrl)
    const commonEnv = { ...process.env }
    const apiEnv: NodeJS.ProcessEnv = {
      ...commonEnv,
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: '3100',
      DATABASE_URL: databaseUrl,
      CORS_ORIGINS: 'http://127.0.0.1:5174',
      SESSION_SECRET: 'system-session-secret-2027-at-least-32-chars',
      OTP_PEPPER: 'system-otp-pepper-2027-at-least-32-chars',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: '1025',
      SMTP_SECURE: 'false',
      AUTH_RATE_LIMIT_MAX_REQUESTS: '100',
      RATE_LIMIT_MAX_REQUESTS: '1000',
      ACTA_STORAGE_DIR: actStorage,
      LOG_LEVEL: 'warn',
    }
    const clientEnv: NodeJS.ProcessEnv = {
      ...commonEnv,
      VITE_API_BASE_URL: 'http://127.0.0.1:3100/api/v1',
      VITE_API_HEALTH_URL: 'http://127.0.0.1:3100/health',
    }

    await runNode(path.join(clientRoot, 'node_modules', 'typescript', 'bin', 'tsc'), ['--noEmit', '-p', 'tsconfig.json'], clientRoot, clientEnv)
    await runNode(path.join(clientRoot, 'node_modules', 'vite', 'bin', 'vite.js'), ['build'], clientRoot, clientEnv)

    api = startNode(path.join(apiRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'), ['src/server.ts'], apiRoot, apiEnv)
    await waitForUrl('http://127.0.0.1:3100/health', api)
    preview = startNode(path.join(clientRoot, 'node_modules', 'vite', 'bin', 'vite.js'), ['preview', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], clientRoot, clientEnv)
    await waitForUrl('http://127.0.0.1:5174', preview)

    await runNode(
      path.join(clientRoot, 'node_modules', '@playwright', 'test', 'cli.js'),
      ['test', '--config', 'playwright.system.config.ts'],
      clientRoot,
      { ...commonEnv, CARNAVALES_SYSTEM_FIXTURE: JSON.stringify(fixture), MAILPIT_API_URL: mailpitApi },
    )
  } finally {
    await stop(preview)
    await stop(api)
    await client.query('RESET search_path').catch((_error: unknown) => undefined)
    if (/^carnavales_system_[a-f0-9]{12}$/.test(schema)) {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch((error: unknown) => {
        console.error('No se pudo eliminar el esquema temporal.', error)
      })
    }
    client.release()
    await adminPool.end()
    await rm(actStorage, { recursive: true, force: true })
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
