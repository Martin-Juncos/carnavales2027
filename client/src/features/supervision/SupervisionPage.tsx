import { FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiAlertTriangle, FiActivity, FiRefreshCw, FiTrendingUp } from 'react-icons/fi'
import { supervisionApi } from '../../api/supervisionApi'
import { ApiClientError } from '../../api/apiClient'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { useAuth } from '../auth/AuthProvider'

interface PenaltyForm {
  comparsaId: string
  puntos: string
  motivoCodigo: string
  motivoDescripcion: string
}

const initialPenalty: PenaltyForm = { comparsaId: '', puntos: '1', motivoCodigo: '', motivoDescripcion: '' }

function errorText(caught: unknown, fallback: string): string {
  return caught instanceof ApiClientError ? caught.message : fallback
}

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleString() : '-'
}

function statusTone(status?: string): 'success' | 'warning' | 'neutral' {
  if (status === 'open') return 'success'
  if (status === 'closed' || status === 'certified') return 'neutral'
  return 'warning'
}

export function SupervisionPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [nightId, setNightId] = useState('1')
  const [penalty, setPenalty] = useState<PenaltyForm>(initialPenalty)
  const [confirmPenalty, setConfirmPenalty] = useState<PenaltyForm | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const parsedNightId = Number(nightId)
  const validNightId = Number.isInteger(parsedNightId) && parsedNightId > 0 ? parsedNightId : undefined

  const nights = useQuery({ queryKey: ['supervision-nights'], queryFn: supervisionApi.nights })
  const nightState = useQuery({
    queryKey: ['supervision-night', validNightId],
    queryFn: () => supervisionApi.nightState(validNightId ?? 0),
    enabled: Boolean(validNightId),
    refetchInterval: 5_000,
  })
  const events = useQuery({
    queryKey: ['supervision-events'],
    queryFn: () => supervisionApi.events(0),
    refetchInterval: 5_000,
  })
  const report = useQuery({
    queryKey: ['night-report', validNightId],
    queryFn: () => supervisionApi.nightReport(validNightId ?? 0),
    enabled: Boolean(validNightId),
  })
  const penalties = useQuery({
    queryKey: ['penalties', validNightId],
    queryFn: () => supervisionApi.penalties({ ...(validNightId ? { nocheId: validNightId } : {}), limit: 50 }),
  })

  const selectedNight = useMemo(
    () => (nights.data ?? []).find((night) => night.id === validNightId),
    [nights.data, validNightId],
  )
  const progress = useMemo(() => nightState.data?.progress ?? [], [nightState.data?.progress])
  const selectedComparsa = useMemo(
    () => progress.find((row) => row.comparsaId === Number(penalty.comparsaId)),
    [penalty.comparsaId, progress],
  )
  const totals = useMemo(() => ({
    votes: progress.reduce((sum, row) => sum + row.votesReceived, 0),
    closes: progress.reduce((sum, row) => sum + row.jurorCloses, 0),
    activePenalties: (penalties.data ?? []).filter((row) => row.estado === 'active').length,
    finalTotal: (report.data ?? []).reduce((sum, row) => sum + (row.finalTotal ?? 0), 0),
  }), [penalties.data, progress, report.data])

  const canCreatePenalty = auth.user?.role === 'fiscal' || auth.user?.role === 'escribano'

  const refreshFiscalPanel = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['supervision-nights'] })
    void queryClient.invalidateQueries({ queryKey: ['supervision-night'] })
    void queryClient.invalidateQueries({ queryKey: ['supervision-events'] })
    void queryClient.invalidateQueries({ queryKey: ['night-report'] })
    void queryClient.invalidateQueries({ queryKey: ['penalties'] })
  }

  const penaltyMutation = useMutation({
    mutationFn: (form: PenaltyForm) => supervisionApi.createPenalty({
      comparsaId: Number(form.comparsaId),
      puntos: Number(form.puntos),
      ...(form.motivoCodigo.trim() ? { motivoCodigo: form.motivoCodigo.trim() } : {}),
      motivoDescripcion: form.motivoDescripcion.trim(),
    }),
    onSuccess: () => {
      setPenalty(initialPenalty)
      setConfirmPenalty(null)
      setMessage('Penalización registrada y auditada.')
      refreshFiscalPanel()
    },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo registrar la penalización.')),
  })

  const submitPenalty = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    setMessage(null)
    if (!penalty.comparsaId || !penalty.motivoDescripcion.trim() || Number(penalty.puntos) <= 0) {
      setMessage('Comparsa, puntos y motivo son obligatorios.')
      return
    }
    setConfirmPenalty(penalty)
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:py-8">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-carnival-naranja-calido">Fiscalización</p>
              <h1 className="mt-2 text-3xl font-black text-slate-50 sm:text-4xl">Panel operativo del Fiscal</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">Monitoreá el avance de la noche, revisá resultados, detectá eventos y registrá penalizaciones sin tocar votos confirmados.</p>
            </div>
            <Button type="button" variant="secondary" onClick={refreshFiscalPanel} disabled={penaltyMutation.isPending}><FiRefreshCw size={18} aria-hidden="true" />Actualizar</Button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="block rounded-2xl border border-white/15 bg-night-950/60 p-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Noche</span>
              <select className="mt-2 min-h-11 w-full rounded-2xl border border-white/20 bg-night-950 px-3 text-base" value={nightId} onChange={(event) => setNightId(event.target.value)} aria-label="Noche fiscalizada">
                {(nights.data ?? []).map((night) => <option key={night.id} value={night.id}>{night.nombre} · {night.fecha}</option>)}
                {(nights.data ?? []).length === 0 ? <option value={nightId}>Noche #{nightId}</option> : null}
              </select>
            </label>
            <div className="rounded-2xl border border-white/15 bg-night-950/60 p-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</span>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(selectedNight?.estado ?? nightState.data?.night?.estado)}>{selectedNight?.estado ?? nightState.data?.night?.estado ?? 'sin datos'}</Badge>
                <span className="text-sm text-slate-300">{selectedNight?.nombre ?? nightState.data?.night?.nombre ?? `Noche #${nightId}`}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Indicadores en vivo</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-3"><p className="text-xs text-slate-400">Votos recibidos</p><p className="mt-1 text-3xl font-black">{totals.votes}</p></div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-3"><p className="text-xs text-slate-400">Cierres</p><p className="mt-1 text-3xl font-black">{totals.closes}</p></div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-3"><p className="text-xs text-slate-400">Penalizaciones activas</p><p className="mt-1 text-3xl font-black text-rose-100">{totals.activePenalties}</p></div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-3"><p className="text-xs text-slate-400">Total general</p><p className="mt-1 text-3xl font-black text-carnival-naranja-calido">{totals.finalTotal}</p></div>
          </div>
          <p className="mt-3 text-sm text-slate-400">Actualización automática cada 5 segundos.</p>
        </Card>
      </section>

      {message ? <Card className="border-carnival-azul-profundo/40 bg-carnival-azul-profundo/10"><p className="text-cyan-100">{message}</p></Card> : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <div className="flex items-center gap-2">
            <FiActivity size={22} className="text-carnival-amarillo-brillante" aria-hidden="true" />
            <h2 className="text-xl font-bold">Avance por comparsa</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {progress.map((row) => (
              <div key={row.comparsaId} className="rounded-2xl border border-white/15 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-bold">{row.comparsaNombre}</p>
                  <Badge tone={row.jurorCloses > 0 ? 'success' : 'warning'}>{row.jurorCloses > 0 ? 'con cierres' : 'en curso'}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <p className="rounded-xl bg-night-950/60 p-2"><span className="block text-slate-400">Votos</span><strong>{row.votesReceived}</strong></p>
                  <p className="rounded-xl bg-night-950/60 p-2"><span className="block text-slate-400">Cierres</span><strong>{row.jurorCloses}</strong></p>
                </div>
              </div>
            ))}
            {nightState.isLoading ? <p className="text-sm text-slate-400">Cargando avance...</p> : null}
            {!nightState.isLoading && progress.length === 0 ? <p className="text-sm text-slate-400">Esta noche todavía no tiene comparsas o votos registrados.</p> : null}
          </div>
        </Card>

        {canCreatePenalty ? (
          <Card>
            <h2 className="text-xl font-bold">Registrar penalización</h2>
            <form className="mt-4 space-y-3" onSubmit={submitPenalty}>
              <label className="block text-sm font-semibold">
                Comparsa
                <select className="mt-1 min-h-11 w-full rounded-2xl border border-white/20 bg-night-950/60 px-3 text-base" value={penalty.comparsaId} onChange={(event) => setPenalty({ ...penalty, comparsaId: event.target.value })} aria-label="Comparsa penalizada">
                  <option value="">Seleccionar comparsa</option>
                  {progress.map((row) => <option key={row.comparsaId} value={row.comparsaId}>{row.comparsaNombre}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold">Puntos<input className="mt-1 min-h-11 w-full rounded-2xl border border-white/20 bg-night-950/60 px-3 text-base" value={penalty.puntos} onChange={(event) => setPenalty({ ...penalty, puntos: event.target.value })} inputMode="numeric" aria-label="Puntos de penalización" /></label>
              <label className="block text-sm font-semibold">Código opcional<input className="mt-1 min-h-11 w-full rounded-2xl border border-white/20 bg-night-950/60 px-3 text-base" value={penalty.motivoCodigo} onChange={(event) => setPenalty({ ...penalty, motivoCodigo: event.target.value })} aria-label="Código de motivo" /></label>
              <label className="block text-sm font-semibold">Motivo<textarea className="mt-1 min-h-24 w-full rounded-2xl border border-white/20 bg-night-950/60 px-3 py-2 text-base" value={penalty.motivoDescripcion} onChange={(event) => setPenalty({ ...penalty, motivoDescripcion: event.target.value })} aria-label="Motivo de penalización" /></label>
              <Button type="submit" variant="danger" className="w-full" disabled={penaltyMutation.isPending || !penalty.comparsaId || !penalty.motivoDescripcion.trim()}><FiAlertTriangle size={18} aria-hidden="true" />Revisar penalización</Button>
            </form>
            {selectedComparsa ? <p className="mt-3 text-sm text-slate-400">Se aplicará sobre {selectedComparsa.comparsaNombre}.</p> : null}
          </Card>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <div className="flex items-center gap-2">
            <FiTrendingUp size={22} className="text-carnival-naranja-calido" aria-hidden="true" />
            <h2 className="text-xl font-bold">Planilla de noche</h2>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-slate-400"><tr><th className="py-2">Comparsa</th><th>Total bruto</th><th>Penalizaciones</th><th>Total final</th></tr></thead>
              <tbody>
                {(report.data ?? []).map((row) => (
                  <tr key={row.comparsaId} className="border-t border-white/15"><td className="py-2 font-semibold">{row.comparsaNombre}</td><td>{row.grossTotal ?? '-'}</td><td>{row.penaltyTotal ?? '-'}</td><td className="font-bold text-carnival-naranja-calido">{row.finalTotal ?? '-'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Penalizaciones registradas</h2>
          <div className="mt-3 max-h-80 space-y-2 overflow-auto">
            {(penalties.data ?? []).map((row) => (
              <div key={row.id} className="rounded-2xl border border-white/15 bg-white/5 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{row.comparsaNombre ?? `Comparsa #${row.comparsaId}`}</p>
                  <Badge tone={row.estado === 'active' ? 'danger' : 'neutral'}>{row.estado}</Badge>
                </div>
                <p className="mt-1 text-slate-400">{row.puntos} punto(s) · {row.motivoDescripcion}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(row.createdAt)}</p>
              </div>
            ))}
            {(penalties.data ?? []).length === 0 ? <p className="text-sm text-slate-400">No hay penalizaciones para esta noche.</p> : null}
          </div>
        </Card>
      </section>

      <Card>
        <h2 className="text-xl font-bold">Eventos recientes</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {(events.data ?? []).slice(-12).reverse().map((event) => (
            <div key={event.id} className="rounded-2xl border border-white/15 bg-white/10 p-3 text-sm">
              <p className="font-semibold">#{event.id} · {event.tipo}</p>
              <p className="text-slate-400">{formatDate(event.createdAt)}</p>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={Boolean(confirmPenalty)}
        title="Confirmar penalización"
        description="La penalización queda auditada y descuenta del total de la comparsa. Verificá antes de confirmar."
        confirmLabel="Registrar penalización"
        danger
        busy={penaltyMutation.isPending}
        onCancel={() => setConfirmPenalty(null)}
        onConfirm={() => { if (confirmPenalty) penaltyMutation.mutate(confirmPenalty) }}
      >
        {confirmPenalty ? <p className="text-slate-100">{selectedComparsa?.comparsaNombre ?? `Comparsa #${confirmPenalty.comparsaId}`} · {confirmPenalty.puntos} punto(s)</p> : null}
      </Modal>
    </main>
  )
}
