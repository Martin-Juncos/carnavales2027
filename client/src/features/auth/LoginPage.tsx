import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { z } from 'zod'
import { ApiClientError } from '../../api/apiClient'
import { useConnectionStatus } from '../../hooks/useConnectionStatus'
import { useAuth } from './AuthProvider'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'

const loginSchema = z.object({ identity: z.string().trim().min(3), password: z.string().min(8) })
const otpSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Ingres? el c?digo de 6 d?gitos.') })

export function LoginPage() {
  const auth = useAuth()
  const connection = useConnectionStatus()
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
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
      const parsed = loginSchema.parse({ identity, password })
      const challenge = await auth.requestOtp(parsed)
      setChallengeId(challenge.challengeId)
      setExpiresIn(challenge.expiresIn)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Revis? usuario y contrase?a.')
    } finally {
      setBusy(false)
    }
  }

  const submitOtp = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!challengeId) return
    setBusy(true)
    setError(null)
    try {
      const parsed = otpSchema.parse({ code })
      await auth.verifyOtp({ challengeId, code: parsed.code })
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'El c?digo ingresado no es v?lido.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0,#050713_45%,#020617_100%)] px-4 py-8 text-slate-50">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-carnival-gold">Carnavales 2027</p>
          <h1 className="mt-3 text-3xl font-black">Sistema de votaci?n</h1>
          <p className="mt-2 text-slate-300">PWA segura, t?ctil y preparada para cortes de conectividad.</p>
        </div>
        <Card>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Ingresar</h2>
            <Badge tone={connection.apiReachable ? 'success' : 'warning'}>{connection.label}</Badge>
          </div>

          {!challengeId ? (
            <form className="space-y-4" onSubmit={(event) => { void submitCredentials(event) }}>
              <label className="block">
                <span className="text-sm font-semibold text-slate-200">Email o DNI</span>
                <input className="mt-2 min-h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-base text-slate-50 outline-none focus:border-carnival-gold focus:ring-2 focus:ring-carnival-gold/40" value={identity} onChange={(event) => setIdentity(event.target.value)} autoComplete="username" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-200">Contrase?a</span>
                <input className="mt-2 min-h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-base text-slate-50 outline-none focus:border-carnival-gold focus:ring-2 focus:ring-carnival-gold/40" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
              </label>
              {error ? <p className="rounded-2xl border border-rose-500/50 bg-rose-500/10 p-3 text-sm text-rose-100" role="alert">{error}</p> : null}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Solicitando c?digo...' : 'Solicitar c?digo'}</Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={(event) => { void submitOtp(event) }}>
              <p className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-3 text-sm text-cyan-100">Te enviamos un c?digo de 6 d?gitos. {expiresIn ? `Expira en ${Math.round(expiresIn / 60)} min.` : null}</p>
              <label className="block">
                <span className="text-sm font-semibold text-slate-200">C?digo OTP</span>
                <input className="mt-2 min-h-14 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-center text-2xl tracking-[0.35em] text-slate-50 outline-none focus:border-carnival-gold focus:ring-2 focus:ring-carnival-gold/40" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" />
              </label>
              {error ? <p className="rounded-2xl border border-rose-500/50 bg-rose-500/10 p-3 text-sm text-rose-100" role="alert">{error}</p> : null}
              <Button type="submit" size="lg" className="w-full" disabled={busy || code.length !== 6}>{busy ? 'Verificando...' : 'Entrar'}</Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setChallengeId(null); setCode('') }} disabled={busy}>Cambiar credenciales</Button>
            </form>
          )}
        </Card>
      </div>
    </main>
  )
}
