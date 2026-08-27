import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supervisionApi } from '../../api/supervisionApi'
import { ApiClientError } from '../../api/apiClient'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { useAuth } from '../auth/AuthProvider'

export function EscribaniaPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [nocheId, setNocheId] = useState('1')
  const [actType, setActType] = useState<'pdf' | 'csv'>('pdf')
  const [actId, setActId] = useState('')
  const [annulPenaltyId, setAnnulPenaltyId] = useState('')
  const [annulReason, setAnnulReason] = useState('')
  const [confirm, setConfirm] = useState<'generate' | 'certify' | 'annul' | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const audit = useQuery({ queryKey: ['audit'], queryFn: () => supervisionApi.audit(0, 100), refetchInterval: 10_000 })
  const verify = useQuery({ queryKey: ['act-verify', actId], queryFn: () => supervisionApi.verifyAct(actId), enabled: false })

  const generateMutation = useMutation({
    mutationFn: () => supervisionApi.generateAct(Number(nocheId), actType),
    onSuccess: (act) => { setMessage(`Acta generada: ${act.id} · SHA-256 ${act.sha256}`); setActId(act.id); setConfirm(null) },
    onError: (caught) => setMessage(caught instanceof ApiClientError ? caught.message : 'No se pudo generar el acta.'),
  })
  const certifyMutation = useMutation({
    mutationFn: () => supervisionApi.certifyAct(actId),
    onSuccess: (act) => { setMessage(`Acta certificada: ${act.id}`); setConfirm(null); void queryClient.invalidateQueries({ queryKey: ['audit'] }) },
    onError: (caught) => setMessage(caught instanceof ApiClientError ? caught.message : 'No se pudo certificar el acta.'),
  })
  const annulMutation = useMutation({
    mutationFn: () => supervisionApi.annulPenalty(annulPenaltyId, { motivo: annulReason }),
    onSuccess: () => { setMessage('Penalización anulada con evento auditado.'); setConfirm(null); setAnnulPenaltyId(''); setAnnulReason('') },
    onError: (caught) => setMessage(caught instanceof ApiClientError ? caught.message : 'No se pudo anular la penalización.'),
  })

  const submitGenerate = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); setConfirm('generate') }
  const submitCertify = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); setConfirm('certify') }
  const submitAnnul = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); setConfirm('annul') }
  const canCertifyOrAnnul = auth.user?.role === 'escribano'

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 xl:grid-cols-[360px_1fr]">
      <aside className="space-y-4">
        <Card>
          <h2 className="text-xl font-bold">Actas oficiales</h2>
          <form className="mt-3 space-y-3" onSubmit={submitGenerate}>
            <label className="block text-sm font-semibold">Noche ID<input id="act-night" name="nocheId" className="mt-1 min-h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3" value={nocheId} onChange={(event) => setNocheId(event.target.value)} inputMode="numeric" /></label>
            <label className="block text-sm font-semibold">Tipo<select id="act-type" name="actType" className="mt-1 min-h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3" value={actType} onChange={(event) => setActType(event.target.value === 'csv' ? 'csv' : 'pdf')}><option value="pdf">PDF</option><option value="csv">CSV</option></select></label>
            <Button type="submit" className="w-full">Generar acta</Button>
          </form>
          <form className="mt-5 space-y-3" onSubmit={(event) => { if (canCertifyOrAnnul) submitCertify(event); else event.preventDefault() }}>
            <label className="block text-sm font-semibold">Acta ID<input id="act-id" name="actId" className="mt-1 min-h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3" value={actId} onChange={(event) => setActId(event.target.value)} /></label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" variant="secondary" onClick={() => { void verify.refetch() }} disabled={!actId}>Verificar hash</Button>
              {canCertifyOrAnnul ? <Button type="submit" disabled={!actId}>Certificar</Button> : null}
            </div>
          </form>
        </Card>

        {canCertifyOrAnnul ? <Card>
          <h2 className="text-xl font-bold">Anular penalización</h2>
          <form className="mt-3 space-y-3" onSubmit={submitAnnul}>
            <label className="block text-sm font-semibold">Penalización ID<input id="annul-penalty-id" name="penaltyId" className="mt-1 min-h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3" value={annulPenaltyId} onChange={(event) => setAnnulPenaltyId(event.target.value)} /></label>
            <label className="block text-sm font-semibold">Motivo<textarea id="annul-reason" name="annulReason" className="mt-1 min-h-24 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2" value={annulReason} onChange={(event) => setAnnulReason(event.target.value)} /></label>
            <Button type="submit" variant="danger" className="w-full" disabled={!annulPenaltyId || annulReason.trim().length < 3}>Revisar anulación</Button>
          </form>
        </Card> : null}
      </aside>

      <section className="space-y-4">
        {message ? <Card className="border-cyan-500/40 bg-cyan-500/10"><p className="text-cyan-100">{message}</p></Card> : null}
        {verify.data ? (
          <Card className={verify.data.valid ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10'}>
            <div className="flex items-center gap-2"><h2 className="text-xl font-bold">Verificación de acta</h2><Badge tone={verify.data.valid ? 'success' : 'danger'}>{verify.data.valid ? 'Válida' : 'No coincide'}</Badge></div>
            <p className="mt-2 break-all text-sm text-slate-200">Esperado: {verify.data.expectedSha256}</p>
            <p className="mt-1 break-all text-sm text-slate-200">Actual: {verify.data.actualSha256}</p>
          </Card>
        ) : null}
        <Card>
          <h2 className="text-xl font-bold">Auditoría reciente</h2>
          <div className="mt-3 space-y-2">
            {(audit.data ?? []).map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm">
                <p className="font-semibold">#{row.id} · {row.accion} · {row.entidad}</p>
                <p className="text-slate-400">{new Date(row.createdAt).toLocaleString()} · actor {row.actorRole ?? 'sistema'}</p>
                {row.operationUuid ? <p className="mt-1 break-all text-xs text-slate-500">operationUuid: {row.operationUuid}</p> : null}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Modal
        open={Boolean(confirm)}
        title={confirm === 'generate' ? 'Generar acta' : confirm === 'certify' ? 'Certificar acta' : 'Anular penalización'}
        description="Esta acción genera evidencia auditable. Verificá los datos antes de continuar."
        confirmLabel="Confirmar"
        danger={confirm !== 'generate'}
        busy={generateMutation.isPending || certifyMutation.isPending || annulMutation.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === 'generate') generateMutation.mutate()
          if (confirm === 'certify') certifyMutation.mutate()
          if (confirm === 'annul') annulMutation.mutate()
        }}
      />
    </main>
  )
}
