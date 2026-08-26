import 'dotenv/config'
import argon2 from 'argon2'
import { z } from 'zod'
import { pool } from '../src/database/pool'

const input = z.object({
  ADMIN_NAME: z.string().min(2),
  ADMIN_DNI: z.string().min(5),
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: z.string().min(12),
}).parse(process.env)

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(input.ADMIN_PASSWORD)
  await pool.query(
    `INSERT INTO users (nombre, dni, email, password_hash, role)
     VALUES ($1,$2,$3,$4,'admin')
     ON CONFLICT (email) DO UPDATE SET
       nombre = EXCLUDED.nombre,
       dni = EXCLUDED.dni,
       password_hash = EXCLUDED.password_hash,
       activo = true`,
    [input.ADMIN_NAME, input.ADMIN_DNI, input.ADMIN_EMAIL.toLowerCase(), passwordHash],
  )
}

main()
  .then(async () => pool.end())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Admin seed failed')
    await pool.end()
    process.exitCode = 1
  })
