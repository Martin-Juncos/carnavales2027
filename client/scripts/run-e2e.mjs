import { spawn } from 'node:child_process'
import { createServer } from 'vite'

const server = await createServer({
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  logLevel: 'error',
})

await server.listen()

const child = spawn(
  process.execPath,
  ['./node_modules/@playwright/test/cli.js', 'test', '--config=playwright.config.ts'],
  {
    stdio: 'inherit',
    env: { ...process.env, CARNAVALES_E2E_MANAGED: '1' },
  },
)

const exitCode = await new Promise((resolve) => {
  child.on('exit', (code) => resolve(code ?? 1))
  child.on('error', () => resolve(1))
})

await server.close()
process.exit(Number(exitCode))
