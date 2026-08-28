import 'dotenv/config'
import argon2 from 'argon2'
import { pool } from '../src/database/pool'

const coreUsers = [
  {
    nombre: 'Martin Juncos',
    dni: '25609038',
    email: 'prof.mcjuncos@gmail.com',
    role: 'admin',
  },
  {
    nombre: 'Modo Beta',
    dni: '12345678',
    email: 'modo.beta.developer@gmail.com',
    role: 'jurado',
  },
] as const

async function main(): Promise<void> {
  for (const user of coreUsers) {
    const passwordHash = await argon2.hash(user.dni)
    await pool.query(
      `INSERT INTO users (nombre, dni, email, password_hash, role, activo)
       VALUES ($1,$2,$3,$4,$5,true)
       ON CONFLICT (email) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         dni = EXCLUDED.dni,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         activo = true,
         updated_at = now()`,
      [user.nombre, user.dni, user.email, passwordHash, user.role],
    )
  }
}

main()
  .then(async () => pool.end())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Core users seed failed')
    await pool.end()
    process.exitCode = 1
  })
