import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiAward, FiCheckCircle, FiFileText, FiRefreshCw, FiShield, FiXCircle } from 'react-icons/fi'
import { supervisionApi, type ActRecord, type PenaltyRecord } from '../../api/supervisionApi'
import { ApiClientError } from '../../api/apiClient'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { useAuth } from '../auth/AuthProvider'

type ConfirmAction =
  | { type: 'generate'; actType: 'pdf' | 'csv' }
  | { type: 'certify'; act: ActRecord }
  | { type: 'annul'; penalty: PenaltyRecord }

function apiError(caught: unknown, fallback: string): string {
  return caught instanceof ApiClientError ? caught.message : fallback
}

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleString() : '-'
}

function actTone(status: string): 'success' | 'warning' | 'neutral' {
  if (status === 'certified') return 'success'
  if (status === 'generated') return 'warning'
  return 'neutral'
}

function confirmTitle(action: ConfirmAction): string {
  if (action.type === 'generate') return `Generar acta ${action.actType.toUpperCase()}`
  if (action.type === 'certify') return 'Certificar acta'
  return 'Anular penalización'
}

export function EscribaniaPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [nocheId, setNocheId] = useState('1')
  const [selectedActId, setSelectedActId] = useState('')
  const [selectedPenaltyId, setSelectedPenaltyId] = useState('')
  const [annulReason, setAnnulReason] = useState('')
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const parsedNightId = Number(nocheId)
  const validNightId = Number.isInteger(parsedNightId) && parsedNightId > 0 ? parsedNightId : undefined
  const canCertifyOrAnnul = auth.user?.role === 'escribano'

  const acts = useQuery({
    queryKey: ['acts', validNightId],
    queryFn: () => supervisionApi.acts({ ...(validNightId ? { nocheId: validNightId } : {}), limit: 50 }),
  })
  const penalties = useQuery({
    queryKey: ['penalties', validNightId],
    queryFn: () => supervisionApi.penalties({ ...(validNightId ? { nocheId: validNightId } : {}), limit: 50 }),
  })
  const report = useQuery({
    queryKey: ['night-report', validNightId],
    queryFn: () => supervisionApi.nightReport(validNightId ?? 0),
    enabled: Boolean(validNightId),
  })
  const audit = useQuery({
    queryKey: ['audit'],
    queryFn: () => supervisionApi.audit(0, 100),
    refetchInterval: 10_000,
  })
  const verify = useQuery({
    queryKey: ['act-verify', selectedActId],
    queryFn: () => supervisionApi.verifyAct(selectedActId),
    enabled: false,
  })

  const selectedAct = useMemo(
    () => (acts.data ?? []).find((act) => act.id === selectedActId),
    [acts.data, selectedActId],
  )
  const activePenalties = useMemo(
    () => (penalties.data ?? []).filter((penalty) => penalty.estado === 'active'),
    [penalties.data],
  )
  const generatedActs = useMemo(
    () => (acts.data ?? []).filter((act) => act.estado === 'generated'),
    [acts.data],
  )

  const refreshWorkspace = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['acts'] })
    void queryClient.invalidateQueries({ queryKey: ['penalties'] })
    void queryClient.invalidateQueries({ queryKey: ['night-report'] })
    void queryClient.invalidateQueries({ queryKey: ['audit'] })
  }

  const generateMutation = useMutation({
    mutationFn: (actType: 'pdf' | 'csv') => supervisionApi.generateAct(validNightId ?? 0, actType),
    onSuccess: (act) => {
      setMessage(`Acta generada: ${act.tipo.toUpperCase()} v${act.version}`)
      setSelectedActId(act.id)
      setConfirm(null)
      refreshWorkspace()
    },
    onError: (caught) => setMessage(apiError(caught, 'No se pudo generar el acta.')),
  })
  const certifyMutation = useMutation({
    mutationFn: (id: string) => supervisionApi.certifyAct(id),
    onSuccess: (act) => {
      setMessage(`Acta certificada: ${act.id}`)
      setConfirm(null)
      refreshWorkspace()
    },
    onError: (caught) => setMessage(apiError(caught, 'No se pudo certificar el acta.')),
  })
  const annulMutation = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => supervisionApi.annulPenalty(id, { motivo }),
    onSuccess: () => {
      setMessage('Penalización anulada con evento auditado.')
      setConfirm(null)
      setSelectedPenaltyId('')
      setAnnulReason('')
      refreshWorkspace()
    },
    onError: (caught) => setMessage(apiError(caught, 'No se pudo anular la penalización.')),
  })

  const busy = generateMutation.isPending || certifyMutation.isPending || annulMutation.isPending

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-5">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-carnival-amarillo-brillante">Escribanía</p>
              <h1 className="mt-2 text-3xl font-black text-slate-50">Panel operativo de actas e integridad</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">Revisá resultados, generá actas, verificá hash, certificá evidencia y anulá penalizaciones con trazabilidad.</p>
            </div>
            <Button type="button" variant="secondary" onClick={refreshWorkspace} disabled={busy}><FiRefreshCw size={18} aria-hidden="true" />Actualizar</Button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <label className="block rounded-2xl border border-white/15 bg-night-950/60 p-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Noche operativa</span>
              <input className="mt-2 min-h-11 w-full rounded-2xl border border-white/20 bg-night-950 px-3 text-lg font-bold" value={nocheId} onChange={(event) => setNocheId(event.target.value)} inputMode="numeric" aria-label="Noche operativa" />
            </label>
            <div className="rounded-2xl border border-white/15 bg-night-950/60 p-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Actas pendientes</span>
              <p className="mt-2 text-3xl font-black text-yellow-100">{generatedActs.length}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-night-950/60 p-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Penalizaciones activas</span>
              <p className="mt-2 text-3xl font-black text-rose-100">{activePenalties.length}</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Acciones principales</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button type="button" size="lg" disabled={!validNightId || busy} onClick={() => setConfirm({ type: 'generate', actType: 'pdf' })}><FiFileText size={18} aria-hidden="true" />Generar PDF</Button>
            <Button type="button" size="lg" variant="secondary" disabled={!validNightId || busy} onClick={() => setConfirm({ type: 'generate', actType: 'csv' })}><FiFileText size={18} aria-hidden="true" />Generar CSV</Button>
            <Button type="button" size="lg" variant="secondary" disabled={!selectedActId || busy} onClick={() => { void verify.refetch() }}><FiShield size={18} aria-hidden="true" />Verificar acta</Button>
            {canCertifyOrAnnul ? <Button type="button" size="lg" disabled={selectedAct?.estado !== 'generated' || busy} onClick={() => { if (selectedAct) setConfirm({ type: 'certify', act: selectedAct }) }}><FiAward size={18} aria-hidden="true" />Certificar seleccionada</Button> : null}
          </div>
          {!canCertifyOrAnnul ? <p className="mt-3 text-sm text-slate-400">Tu rol puede consultar y generar según permisos, pero solo escribano certifica o anula.</p> : null}
        </Card>
      </section>

      {message ? <Card className="border-carnival-azul-profundo/40 bg-carnival-azul-profundo/10"><p className="text-cyan-100">{message}</p></Card> : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="text-xl font-bold">Resultados a certificar</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-slate-400"><tr><th className="py-2">Comparsa</th><th>Bruto</th><th>Penalizaciones</th><th>Final</th></tr></thead>
              <tbody>
                {(report.data ?? []).map((row) => (
                  <tr key={row.comparsaId} className="border-t border-white/15">
                    <td className="py-2 font-semibold">{row.comparsaNombre}</td>
                    <td>{row.grossTotal ?? '-'}</td>
                    <td>{row.penaltyTotal ?? '-'}</td>
                    <td className="font-bold text-carnival-naranja-calido">{row.finalTotal ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.isLoading ? <p className="mt-3 text-sm text-slate-400">Cargando resultados...</p> : null}
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Verificación de integridad</h2>
          {verify.data ? (
            <div className={`mt-3 rounded-2xl border p-4 ${verify.data.valid ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10'}`}>
              <div className="flex items-center gap-2">
                {verify.data.valid ? <FiCheckCircle className="text-emerald-200" size={22} aria-hidden="true" /> : <FiXCircle className="text-rose-200" size={22} aria-hidden="true" />}
                <Badge tone={verify.data.valid ? 'success' : 'danger'}>{verify.data.valid ? 'Hash válido' : 'Hash no coincide'}</Badge>
              </div>
              <p className="mt-3 break-all text-xs text-slate-300">Esperado: {verify.data.expectedSha256}</p>
              <p className="mt-1 break-all text-xs text-slate-300">Actual: {verify.data.actualSha256}</p>
            </div>
          ) : <p className="mt-3 text-sm text-slate-400">Seleccioná un acta y presioná “Verificar acta”.</p>}
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="text-xl font-bold">Actas de la noche</h2>
          <div className="mt-3 max-h-[34rem] space-y-3 overflow-auto">
            {(acts.data ?? []).map((act) => (
              <button
                key={act.id}
                type="button"
                className={`w-full rounded-2xl border p-4 text-left transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carnival-naranja-calido ${selectedActId === act.id ? 'border-carnival-naranja-calido bg-carnival-naranja-calido/10' : 'border-white/15 bg-white/5'}`}
                onClick={() => setSelectedActId(act.id)}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">{act.tipo.toUpperCase()} · versión {act.version}</p>
                  <Badge tone={actTone(act.estado)}>{act.estado}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-400">Generada: {formatDate(act.generadaAt)}</p>
                <p className="mt-2 break-all text-xs text-slate-500">ID: {act.id}</p>
                <p className="mt-1 break-all text-xs text-slate-500">SHA-256: {act.sha256}</p>
              </button>
            ))}
            {acts.isLoading ? <p className="text-sm text-slate-400">Cargando actas...</p> : null}
            {!acts.isLoading && (acts.data ?? []).length === 0 ? <p className="text-sm text-slate-400">Todavía no hay actas para esta noche.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Penalizaciones</h2>
          <div className="mt-3 max-h-[34rem] space-y-3 overflow-auto">
            {(penalties.data ?? []).map((penalty) => (
              <div key={penalty.id} className={`rounded-2xl border p-4 ${selectedPenaltyId === penalty.id ? 'border-carnival-rojo-vibrante bg-rose-500/10' : 'border-white/15 bg-white/5'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{penalty.comparsaNombre ?? `Comparsa #${penalty.comparsaId}`}</p>
                    <p className="text-sm text-slate-400">{penalty.puntos} punto(s) · {penalty.motivoDescripcion}</p>
                  </div>
                  <Badge tone={penalty.estado === 'active' ? 'danger' : 'neutral'}>{penalty.estado}</Badge>
                </div>
                <p className="mt-2 text-xs text-slate-500">Registrada: {formatDate(penalty.createdAt)}</p>
                {canCertifyOrAnnul && penalty.estado === 'active' ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      className="min-h-20 w-full rounded-2xl border border-white/20 bg-night-950/60 px-3 py-2 text-sm"
                      placeholder="Motivo de anulación"
                      value={selectedPenaltyId === penalty.id ? annulReason : ''}
                      onChange={(event) => { setSelectedPenaltyId(penalty.id); setAnnulReason(event.target.value) }}
                    />
                    <Button type="button" variant="danger" disabled={busy || selectedPenaltyId !== penalty.id || annulReason.trim().length < 3} onClick={() => setConfirm({ type: 'annul', penalty })}><FiXCircle size={18} aria-hidden="true" />Anular</Button>
                  </div>
                ) : null}
              </div>
            ))}
            {penalties.isLoading ? <p className="text-sm text-slate-400">Cargando penalizaciones...</p> : null}
            {!penalties.isLoading && (penalties.data ?? []).length === 0 ? <p className="text-sm text-slate-400">No hay penalizaciones registradas para esta noche.</p> : null}
          </div>
        </Card>
      </section>

      <Card>
        <h2 className="text-xl font-bold">Auditoría reciente</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {(audit.data ?? []).slice(0, 12).map((row) => (
            <div key={row.id} className="rounded-2xl border border-white/15 bg-white/10 p-3 text-sm">
              <p className="font-semibold">#{row.id} · {row.accion} · {row.entidad}</p>
              <p className="text-slate-400">{formatDate(row.createdAt)} · actor {row.actorRole ?? 'sistema'}</p>
              {row.operationUuid ? <p className="mt-1 break-all text-xs text-slate-500">operationUuid: {row.operationUuid}</p> : null}
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={Boolean(confirm)}
        title={confirm ? confirmTitle(confirm) : 'Confirmar acción'}
        description="Esta acción genera evidencia auditable. Verificá los datos antes de continuar."
        confirmLabel="Confirmar"
        danger={confirm?.type !== 'generate'}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.type === 'generate') generateMutation.mutate(confirm.actType)
          if (confirm?.type === 'certify') certifyMutation.mutate(confirm.act.id)
          if (confirm?.type === 'annul') annulMutation.mutate({ id: confirm.penalty.id, motivo: annulReason.trim() })
        }}
      >
        {confirm?.type === 'certify' ? <p className="break-all text-sm text-slate-200">Acta: {confirm.act.id}</p> : null}
        {confirm?.type === 'annul' ? <p className="text-sm text-slate-200">Penalización de {confirm.penalty.puntos} punto(s) para {confirm.penalty.comparsaNombre ?? `comparsa #${confirm.penalty.comparsaId}`}.</p> : null}
      </Modal>
    </main>
  )
}
