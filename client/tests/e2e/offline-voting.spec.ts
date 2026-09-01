import { test, expect, type Route } from '@playwright/test'

const user = { id: '11111111-1111-4111-8111-111111111111', nombre: 'Jurado Uno', email: 'jurado@example.com', role: 'jurado', sessionId: 'session-1' }
const nights = [{ id: 1, name: 'Noche 1', status: 'open' }]
const context = {
  assignment: { id: 'assignment-1', night: { id: 1, name: 'Noche 1', status: 'open' } },
  comparsas: [{ id: 10, nombre: 'Ará Berá', orden: 1 }],
  items: [{ id: 2, nombre: 'Música', parentItemId: null, orden: 1 }],
  votes: [],
  closes: [],
}

test('juror vote survives lost connectivity, reloads, and syncs idempotently', async ({ page }) => {
  let syncMode: 'abort' | 'success' = 'abort'
  let loggedIn = false

  await page.route('**/health', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { status: 'ok' }, meta: {} }) }))
  await page.route('**/api/v1/auth/login', (route) => route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ data: { challengeId: '22222222-2222-4222-8222-222222222222', expiresIn: 300 }, meta: {} }) }))
  await page.route('**/api/v1/auth/otp/verify', (route) => {
    loggedIn = true
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { user, expiresAt: '2027-02-07T06:00:00Z' }, meta: {} }) })
  })
  await page.route('**/api/v1/auth/me', (route) => {
    if (!loggedIn) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'AUTH_REQUIRED', message: 'Autenticación requerida.', requestId: 'request-1', retryable: false } }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { user }, meta: {} }) })
  })
  await page.route('**/api/v1/auth/logout', (route) => route.fulfill({ status: 204, body: '' }))
  await page.route('**/api/v1/jurado/noches', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: nights, meta: {} }) }))
  await page.route('**/api/v1/jurado/noches/1/contexto', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: context, meta: {} }) }))
  await page.route('**/api/v1/jurado/sync/reconcile', async (route: Route) => {
    if (syncMode === 'abort') {
      await route.abort()
      return
    }
    const requestBody = route.request().postDataJSON() as { operations: { operationId: string }[] }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          operations: requestBody.operations.map((operation) => ({ operationId: operation.operationId, status: 'ALREADY_APPLIED', resource: { id: 'vote-1', serverReceivedAt: '2027-02-06T22:05:00Z' } })),
        },
        meta: { count: requestBody.operations.length },
      }),
    })
  })

  await page.goto('/login')
  await page.getByLabel('Nombre').fill('Jurado Uno')
  await page.getByLabel('Email').fill(user.email)
  await page.getByRole('textbox', { name: /^DNI/ }).fill('12345678')
  await page.getByRole('button', { name: /solicitar código/i }).click()
  await page.getByLabel(/código otp/i).fill('123456')
  await page.getByRole('button', { name: /^entrar$/i }).click()

  await page.getByRole('heading', { name: 'Noche 1' }).click()
  await expect(page.getByRole('heading', { name: 'Ará Berá' })).toBeVisible()

  await page.getByLabel(/seleccionar nota para música/i).selectOption('4')
  await page.getByRole('dialog').getByRole('button', { name: /confirmar nota/i }).click()
  await expect(page.getByRole('combobox', { name: /nota bloqueada para música/i })).toBeVisible()
  await expect(page.getByText(/^pendiente$/i).first()).toBeVisible()

  await page.reload()
  await page.getByRole('heading', { name: 'Noche 1' }).click()
  await expect(page.getByRole('combobox', { name: /nota bloqueada para música/i })).toBeVisible()
  await expect(page.getByText(/^pendiente$/i).first()).toBeVisible()

  syncMode = 'success'
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByText(/^confirmado$/i).first()).toBeVisible({ timeout: 15_000 })
})