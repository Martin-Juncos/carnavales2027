import { expect, test, type Page } from '@playwright/test'

interface Fixture {
  password: string
  users: Record<'admin' | 'fiscal' | 'escribano' | 'jurado', { dni: string; email: string; id: string; nombre: string }>
  nightId: number
  comparsaId: number
  itemNames: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFixtureUser(value: unknown): value is Fixture['users']['admin'] {
  return isRecord(value)
    && typeof value.dni === 'string'
    && typeof value.email === 'string'
    && typeof value.id === 'string'
    && typeof value.nombre === 'string'
}

function isFixture(value: unknown): value is Fixture {
  if (!isRecord(value) || !isRecord(value.users)) return false
  return typeof value.password === 'string'
    && typeof value.nightId === 'number'
    && typeof value.comparsaId === 'number'
    && Array.isArray(value.itemNames)
    && value.itemNames.every((item) => typeof item === 'string')
    && isFixtureUser(value.users.admin)
    && isFixtureUser(value.users.fiscal)
    && isFixtureUser(value.users.escribano)
    && isFixtureUser(value.users.jurado)
}

const loadedFixture: unknown = JSON.parse(process.env.CARNAVALES_SYSTEM_FIXTURE ?? 'null')
const mailpitApi = process.env.MAILPIT_API_URL ?? 'http://127.0.0.1:8025'

if (!isFixture(loadedFixture)) throw new Error('CARNAVALES_SYSTEM_FIXTURE es obligatoria y debe tener forma válida.')
const fixture: Fixture = loadedFixture

async function latestOtp(email: string): Promise<string> {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const search = await fetch(`${mailpitApi}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
    if (!search.ok) throw new Error(`Mailpit search respondió HTTP ${search.status}.`)
    const payload = await search.json() as { messages?: Array<{ ID?: string; id?: string }> }
    const id = payload.messages?.[0]?.ID ?? payload.messages?.[0]?.id
    if (id) {
      const message = await fetch(`${mailpitApi}/view/${id}.txt`)
      const text = await message.text()
      const code = /\b\d{6}\b/.exec(text)?.[0]
      if (code) return code
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`No llegó el OTP para ${email}.`)
}

async function login(page: Page, role: keyof Fixture['users']): Promise<void> {
  const account = fixture.users[role]
  await page.goto('/login')
  await page.getByLabel(/^nombre$/i).fill(account.nombre)
  await page.getByLabel(/^email$/i).fill(account.email)
  await page.getByRole('textbox', { name: /^dni/i }).fill(account.dni)
  await page.getByRole('button', { name: /solicitar código/i }).click()
  await expect(page.getByLabel(/código otp/i)).toBeVisible()
  await page.getByLabel(/código otp/i).fill(await latestOtp(account.email))
  await page.getByRole('button', { name: /^entrar$/i }).click()
  await expect(page.getByRole('button', { name: /^salir$/i })).toBeVisible()
}

async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^salir$/i }).click()
  await expect(page.getByRole('heading', { name: /sistema de votación/i })).toBeVisible()
}

test.describe.serial('stack real Carnavales 2027', () => {
  test('Admin → Jurado offline → Fiscal → Escribano', async ({ page }) => {
    await login(page, 'admin')
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible()
    await expect(page.getByText('#1 · Noche 1', { exact: true })).toBeVisible()
    await expect(page.getByText('Ará Berá').first()).toBeVisible()
    await page.getByRole('link', { name: 'Escribanía' }).click()
    await expect(page.getByRole('button', { name: /generar acta/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^certificar$/i })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /anular penalización/i })).toHaveCount(0)
    await logout(page)

    await login(page, 'jurado')
    await expect(page).toHaveURL(/\/jurado$/)
    await page.getByRole('heading', { name: 'Noche 1' }).click()
    await expect(page.getByRole('heading', { name: 'Ará Berá' })).toBeVisible()
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
    })
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

    const cachedShell = await page.evaluate(async () => {
      const keys = await caches.keys()
      const requests = (await Promise.all(keys.map(async (key) => (await caches.open(key)).keys()))).flat()
      return requests.map((request) => new URL(request.url).pathname)
    })
    expect(cachedShell).toContain('/')
    expect(cachedShell.some((entry) => entry.startsWith('/assets/') && entry.endsWith('.js'))).toBeTruthy()
    expect(cachedShell.some((entry) => entry.startsWith('/assets/') && entry.endsWith('.css'))).toBeTruthy()
    await page.route('http://127.0.0.1:3100/**', (route) => route.abort('internetdisconnected'))
    await page.getByLabel(/seleccionar nota para diseño/i).selectOption('4')
    await page.getByRole('dialog').getByRole('button', { name: /confirmar nota/i }).click()
    await expect(page.getByRole('combobox', { name: /nota bloqueada para diseño/i })).toHaveCount(1)
    await expect(page.getByText(/^pendiente$/i).first()).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: /usar última noche cacheada/i }).click()
    await expect(page.getByRole('combobox', { name: /nota bloqueada para diseño/i })).toHaveCount(1)

    await page.unroute('http://127.0.0.1:3100/**')
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect(page.getByText(/^confirmado$/i).first()).toBeVisible({ timeout: 20_000 })

    for (const [item, score] of [['Terminación', 5], ['Música', 3]] as const) {
      await page.getByLabel(new RegExp(`seleccionar nota para ${item}`, 'i')).selectOption(String(score))
      await page.getByRole('dialog').getByRole('button', { name: /confirmar nota/i }).click()
      await expect(page.getByRole('combobox', { name: /nota bloqueada para/i })).toHaveCount(score === 5 ? 2 : 3)
      await expect(page.getByText(/^confirmado$/i)).toHaveCount(score === 5 ? 2 : 3, { timeout: 20_000 })
    }
    await expect(page.getByRole('button', { name: /cerrar comparsa/i }).first()).toBeEnabled()
    await page.getByRole('button', { name: /cerrar comparsa/i }).first().click()
    await page.getByRole('dialog').getByRole('button', { name: /cerrar comparsa/i }).click()
    await expect(page.getByText(/comparsa tiene cierre registrado/i)).toBeVisible({ timeout: 20_000 })
    await logout(page)

    await login(page, 'fiscal')
    await expect(page).toHaveURL(/\/supervision$/)
    await page.getByLabel('Noche').fill(String(fixture.nightId))
    await page.getByLabel(/comparsa id/i).fill(String(fixture.comparsaId))
    await page.getByLabel('Puntos').fill('2')
    await page.getByLabel(/^motivo$/i).fill('Penalización fija de prueba')
    await page.getByRole('button', { name: /revisar penalización/i }).click()
    const penaltyResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/penalizaciones') && response.request().method() === 'POST')
    await page.getByRole('dialog').getByRole('button', { name: /registrar penalización/i }).press('Enter')
    const penaltyResponse = await penaltyResponsePromise
    expect(penaltyResponse.status()).toBe(201)
    const penaltyEnvelope = await penaltyResponse.json() as { data: { id: string } }
    const penaltyId = penaltyEnvelope.data.id
    await expect(page.getByRole('cell', { name: '2', exact: true })).toBeVisible()
    await logout(page)

    await login(page, 'escribano')
    await page.getByRole('link', { name: 'Escribanía' }).click()
    await page.getByLabel(/penalización id/i).fill(penaltyId)
    await page.getByLabel(/^motivo$/i).fill('Anulación verificada por Escribano')
    await page.getByRole('button', { name: /revisar anulación/i }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^confirmar$/i }).press('Enter')
    await expect(page.getByText(/penalización anulada con evento auditado/i)).toBeVisible()

    await page.getByLabel(/noche id/i).fill(String(fixture.nightId))
    await page.getByLabel('Tipo').selectOption('csv')
    await page.getByRole('button', { name: /generar acta/i }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^confirmar$/i }).press('Enter')
    await expect(page.getByText(/acta generada:/i)).toBeVisible()
    await page.getByRole('button', { name: /verificar hash/i }).click()
    await expect(page.getByText('Válida', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /^certificar$/i }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^confirmar$/i }).press('Enter')
    await expect(page.getByText(/acta certificada:/i)).toBeVisible()
    await expect(page.getByText(/penalty\.annulled/i)).toBeVisible()
    await expect(page.getByText(/act\.certified/i)).toBeVisible()

    const dbEvidence = await page.request.get('http://127.0.0.1:3100/api/v1/audit?after=0&limit=100')
    expect(dbEvidence.ok()).toBeTruthy()
    const audit = await dbEvidence.json() as { data: Array<{ accion: string }> }
    expect(audit.data.filter((row) => row.accion === 'vote.confirmed')).toHaveLength(3)
    expect(audit.data.some((row) => row.accion === 'penalty.created')).toBeTruthy()
    expect(audit.data.some((row) => row.accion === 'penalty.annulled')).toBeTruthy()
    expect(audit.data.some((row) => row.accion === 'act.generated')).toBeTruthy()
    expect(audit.data.some((row) => row.accion === 'act.certified')).toBeTruthy()
  })
})
