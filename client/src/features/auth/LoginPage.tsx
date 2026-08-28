import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { z } from 'zod'
import { ApiClientError } from '../../api/apiClient'
import { useConnectionStatus } from '../../hooks/useConnectionStatus'
import { useAuth } from './AuthProvider'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { PasswordInput } from '../../components/ui/PasswordInput'

const loginSchema = z.object({
  nombre: z.string().trim().min(2, 'Ingresá tu nombre.'),
  email: z.string().email('Ingresá un email válido.'),
  dni: z.string().trim().min(5, 'Ingresá tu DNI.'),
})
const otpSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Ingresá el código de 6 dígitos.') })

export function LoginPage() {
  const auth = useAuth()
  const connection = useConnectionStatus()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [dni, setDni] = useState('')
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [expiresIn, setExpiresIn] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (auth.user) return <Navigate to="/" replace />

  const submitCredentials = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const parsed = loginSchema.parse({ nombre, email, dni })
      const challenge = await auth.requestOtp(parsed)
      setChallengeId(challenge.challengeId)
      setExpiresIn(challenge.expiresIn)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Revisá nombre, email y DNI.')
    } finally {
      setBusy(false)
    }
  }

  const verifyCode = async (): Promise<void> => {
    if (!challengeId) return
    setBusy(true)
    setError(null)
    try {
      const parsed = otpSchema.parse({ code })
      await auth.verifyOtp({ challengeId, code: parsed.code })
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'El código ingresado no es válido.')
    } finally {
      setBusy(false)
    }
  }

  const submitOtp = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    await verifyCode()
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0,#050713_45%,#020617_100%)] px-4 py-8 text-slate-50">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-carnival-gold">Carnavales 2027</p>
          <h1 className="mt-3 text-3xl font-black">Sistema de votación</h1>
          <p className="mt-2 text-slate-300">PWA segura, táctil y preparada para cortes de conectividad.</p>
        </div>
        <Card>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Ingresar</h2>
            <Badge tone={connection.apiReachable ? 'success' : 'warning'}>{connection.label}</Badge>
          </div>

          <form className="space-y-4" onSubmit={(event) => { void submitCredentials(event) }}>
              <label className="block">
                <span className="text-sm font-semibold text-slate-200">Nombre</span>
                <input id="login-name" name="nombre" className="mt-2 min-h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-base text-slate-50 outline-none focus:border-carnival-gold focus:ring-2 focus:ring-carnival-gold/40" value={nombre} onChange={(event) => setNombre(event.target.value)} autoComplete="name" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-200">Email</span>
                <input id="login-email" name="email" className="mt-2 min-h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-base text-slate-50 outline-none focus:border-carnival-gold focus:ring-2 focus:ring-carnival-gold/40" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-200">DNI</span>
                <PasswordInput id="login-dni" name="dni" className="mt-2 min-h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-base text-slate-50 outline-none focus:border-carnival-gold focus:ring-2 focus:ring-carnival-gold/40" value={dni} onChange={(event) => setDni(event.target.value)} autoComplete="current-password" inputMode="numeric" toggleLabel="Mostrar u ocultar DNI" />
              </label>
              {error ? <p className="rounded-2xl border border-rose-500/50 bg-rose-500/10 p-3 text-sm text-rose-100" role="alert">{error}</p> : null}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Solicitando código...' : 'Solicitar código'}</Button>
            </form>
        </Card>
      </div>
      <Modal
        open={Boolean(challengeId)}
        title="Confirmar autenticación"
        description={expiresIn ? `Te enviamos un código de 6 dígitos. Expira en ${Math.round(expiresIn / 60)} min.` : 'Te enviamos un código de 6 dígitos.'}
        confirmLabel="Entrar"
        cancelLabel="Cambiar datos"
        busy={busy}
        confirmDisabled={code.length !== 6}
        onCancel={() => { setChallengeId(null); setCode(''); setError(null) }}
        onConfirm={() => { void verifyCode() }}
      >
        <form className="space-y-4" onSubmit={(event) => { void submitOtp(event) }}>
          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Código OTP</span>
            <input id="login-otp" name="otp" className="mt-2 min-h-14 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-center text-2xl tracking-[0.35em] text-slate-50 outline-none focus:border-carnival-gold focus:ring-2 focus:ring-carnival-gold/40" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus />
          </label>
          {error ? <p className="rounded-2xl border border-rose-500/50 bg-rose-500/10 p-3 text-sm text-rose-100" role="alert">{error}</p> : null}
        </form>
      </Modal>
    </main>
  )
}
