import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

export function SupervisionPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [nightId, setNightId] = useState('1')
  const [penalty, setPenalty] = useState<PenaltyForm>(initialPenalty)
  const [confirmPenalty, setConfirmPenalty] = useState<PenaltyForm | null>(null)
  const [error, setError] = useState<string | null>(null)
  const parsedNightId = Number(nightId)

  const nightState = useQuery({
    queryKey: ['supervision-night', parsedNightId],
    queryFn: () => supervisionApi.nightState(parsedNightId),
    enabled: Number.isInteger(parsedNightId) && parsedNightId > 0,
    refetchInterval: 5_000,
  })

  const events = useQuery({
    queryKey: ['supervision-events'],
    queryFn: () => supervisionApi.events(0),
    refetchInterval: 5_000,
  })

  const report = useQuery({
    queryKey: ['night-report', parsedNightId],
    queryFn: () => supervisionApi.nightReport(parsedNightId),
    enabled: Number.isInteger(parsedNightId) && parsedNightId > 0,
  })

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
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['night-report', parsedNightId] })
    },
    onError: (caught) => setError(caught instanceof ApiClientError ? caught.message : 'No se pudo registrar la penalización.'),
  })

  const submitPenalty = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    setError(null)
    if (!penalty.comparsaId || !penalty.motivoDescripcion.trim() || Number(penalty.puntos) <= 0) {
      setError('Comparsa, puntos y motivo son obligatorios.')
      return
    }
    setConfirmPenalty(penalty)
  }

  const canCreatePenalty = auth.user?.role === 'fiscal' || auth.user?.role === 'escribano'

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 xl:grid-cols-[360px_1fr]">
      <aside className="space-y-4">
        <Card>
          <h2 className="text-xl font-bold">Supervisión</h2>
          <label className="mt-4 block">
            <span className="text-sm font-semibold text-slate-200">Noche</span>
            <input id="supervision-night" name="nightId" className="mt-2 min-h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-slate-50" type="number" min="1" value={nightId} onChange={(event) => setNightId(event.target.value)} />
          </label>
          <p className="mt-3 text-sm text-slate-400">Actualización por polling controlado. No se asumen WebSockets.</p>
        </Card>

        {canCreatePenalty ? (
          <Card>
            <h2 className="text-lg font-bold">Registrar penalización</h2>
            <form className="mt-3 space-y-3" onSubmit={submitPenalty}>
              <label className="block text-sm font-semibold">Comparsa ID<input id="penalty-comparsa" name="comparsaId" className="mt-1 min-h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3" value={penalty.comparsaId} onChange={(event) => setPenalty({ ...penalty, comparsaId: event.target.value })} inputMode="numeric" /></label>
              <label className="block text-sm font-semibold">Puntos<input id="penalty-points" name="puntos" className="mt-1 min-h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3" value={penalty.puntos} onChange={(event) => setPenalty({ ...penalty, puntos: event.target.value })} inputMode="numeric" /></label>
              <label className="block text-sm font-semibold">Código de motivo opcional<input id="penalty-code" name="motivoCodigo" className="mt-1 min-h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3" value={penalty.motivoCodigo} onChange={(event) => setPenalty({ ...penalty, motivoCodigo: event.target.value })} /></label>
              <label className="block text-sm font-semibold">Motivo<textarea id="penalty-reason" name="motivoDescripcion" className="mt-1 min-h-24 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2" value={penalty.motivoDescripcion} onChange={(event) => setPenalty({ ...penalty, motivoDescripcion: event.target.value })} /></label>
              {error ? <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100" role="alert">{error}</p> : null}
              <Button type="submit" className="w-full">Revisar penalización</Button>
            </form>
          </Card>
        ) : null}
      </aside>

      <section className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Estado de noche</h2>
            {nightState.data?.night ? <Badge tone={nightState.data.night.estado === 'open' ? 'success' : 'warning'}>{nightState.data.night.estado}</Badge> : null}
          </div>
          {nightState.isLoading ? <p className="mt-4 text-slate-300">Cargando...</p> : null}
          {nightState.error ? <p className="mt-4 text-rose-200">{nightState.error.message}</p> : null}
          {nightState.data ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="font-bold text-slate-100">Jurados asignados</h3>
                <div className="mt-2 space-y-2">
                  {nightState.data.assignments.map((assignment) => (
                    <div key={assignment.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
                      <p className="font-semibold">{assignment.nombre}</p>
                      <p className="text-sm text-slate-400">{assignment.estado} · {new Date(assignment.asignadoAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-100">Progreso por comparsa</h3>
                <div className="mt-2 space-y-2">
                  {nightState.data.progress.map((row) => (
                    <div key={row.comparsaId} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
                      <p className="font-semibold">{row.comparsaNombre}</p>
                      <p className="text-sm text-slate-400">{row.votesReceived} votos recibidos · {row.jurorCloses} cierres de jurado</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Planilla de noche</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-slate-400"><tr><th className="py-2">Comparsa</th><th>Total bruto</th><th>Penalizaciones</th><th>Total final</th></tr></thead>
              <tbody>
                {(report.data ?? []).map((row) => (
                  <tr key={row.comparsaId} className="border-t border-slate-800"><td className="py-2 font-semibold">{row.comparsaNombre}</td><td>{row.grossTotal ?? '-'}</td><td>{row.penaltyTotal ?? '-'}</td><td className="font-bold text-carnival-gold">{row.finalTotal ?? '-'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Eventos recientes</h2>
          <div className="mt-3 space-y-2">
            {(events.data ?? []).slice(-10).map((event) => (
              <div key={event.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm">
                <p className="font-semibold">#{event.id} · {event.tipo}</p>
                <p className="text-slate-400">{new Date(event.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Modal
        open={Boolean(confirmPenalty)}
        title="Confirmar penalización"
        description="La penalización queda auditada. No se borra físicamente; una anulación requiere otro evento autorizado."
        confirmLabel="Registrar penalización"
        danger
        busy={penaltyMutation.isPending}
        onCancel={() => setConfirmPenalty(null)}
        onConfirm={() => { if (confirmPenalty) penaltyMutation.mutate(confirmPenalty) }}
      >
        {confirmPenalty ? <p className="text-slate-100">Comparsa #{confirmPenalty.comparsaId} · {confirmPenalty.puntos} punto(s)</p> : null}
      </Modal>
    </main>
  )
}
