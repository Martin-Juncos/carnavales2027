import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { z } from 'zod'
import { FiLoader, FiSend } from 'react-icons/fi'
import { ApiClientError } from '../../api/apiClient'
import { useAuth } from './AuthProvider'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#2E6B45_0%,#1A4A2E_55%,#10271A_100%)] px-4 py-8 text-slate-50">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-6 text-center">
          <p className="font-display text-4xl font-black leading-none text-carnival-naranja-calido">Carnavales 2027</p>
          <h1 className="font-heading mt-2 text-3xl text-slate-50">Sistema de votación</h1>
          <p className="mt-2 text-slate-300">Acceso seguro para operar durante el evento.</p>
        </div>
        <Card>
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-carnival-naranja-calido">Acceso operativo</p>
            <h2 className="mt-2 text-2xl font-black">Ingresar</h2>
          </div>

          <form className="space-y-4" onSubmit={(event) => { void submitCredentials(event) }}>
              <label className="block">
                <span className="text-sm font-semibold text-slate-200">Nombre</span>
                <input id="login-name" name="nombre" className="mt-2 min-h-12 w-full rounded-2xl border border-white/25 bg-night-950/60 px-4 text-base text-slate-50 outline-none focus:border-carnival-naranja-calido focus:ring-2 focus:ring-carnival-naranja-calido/40" value={nombre} onChange={(event) => setNombre(event.target.value)} autoComplete="name" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-200">Email</span>
                <input id="login-email" name="email" className="mt-2 min-h-12 w-full rounded-2xl border border-white/25 bg-night-950/60 px-4 text-base text-slate-50 outline-none focus:border-carnival-naranja-calido focus:ring-2 focus:ring-carnival-naranja-calido/40" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-200">DNI</span>
                <PasswordInput id="login-dni" name="dni" className="mt-2 min-h-12 w-full rounded-2xl border border-white/25 bg-night-950/60 px-4 text-base text-slate-50 outline-none focus:border-carnival-naranja-calido focus:ring-2 focus:ring-carnival-naranja-calido/40" value={dni} onChange={(event) => setDni(event.target.value)} autoComplete="current-password" inputMode="numeric" toggleLabel="Mostrar u ocultar DNI" />
              </label>
              {error ? <p className="rounded-2xl border border-rose-500/50 bg-rose-500/10 p-3 text-sm text-rose-100" role="alert">{error}</p> : null}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? <><FiLoader size={18} className="animate-spin" aria-hidden="true" />Solicitando código...</> : <><FiSend size={18} aria-hidden="true" />Solicitar código</>}
              </Button>
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
            <input id="login-otp" name="otp" className="mt-2 min-h-14 w-full rounded-2xl border border-white/25 bg-night-950/60 px-4 text-center text-2xl tracking-[0.35em] text-slate-50 outline-none focus:border-carnival-naranja-calido focus:ring-2 focus:ring-carnival-naranja-calido/40" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus />
          </label>
          {error ? <p className="rounded-2xl border border-rose-500/50 bg-rose-500/10 p-3 text-sm text-rose-100" role="alert">{error}</p> : null}
        </form>
      </Modal>
    </main>
  )
}
