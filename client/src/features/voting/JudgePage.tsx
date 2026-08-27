import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { juradoApi } from '../../api/juradoApi'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { ConflictBanner } from '../../components/domain/ConflictBanner'
import { PendingOperationsIndicator } from '../../components/domain/PendingOperationsIndicator'
import { SyncStatusBadge } from '../../components/domain/SyncStatusBadge'
import { useConnectionStatus } from '../../hooks/useConnectionStatus'
import { useSyncSummary } from '../../hooks/useSyncSummary'
import { useAuth } from '../auth/AuthProvider'
import { SYNC_EVENT_NAME } from '../../offline/db'
import {
  enqueueCloseComparsaOperation,
  enqueueVoteOperation,
  getCloseDrafts,
  getJuradoContextCache,
  getVoteDrafts,
  saveJuradoContextCache,
} from '../../offline/syncRepository'
import { processSyncQueue, scheduleSync } from '../../offline/syncEngine'
import type { Comparsa, ComparsaCloseDraft, JuradoContext, ScoringItem, VoteDraft } from '../../types/domain'
import { buildItemTree, calculateParentTotal, closeStatus, missingScorableItems, progressForComparsa, progressLabel, scoreStateForItem, type ItemNode } from './voteCalculations'
import { VoteInput } from './VoteInput'

interface PendingVoteSelection {
  comparsa: Comparsa
  item: ScoringItem
  value: number
}

function renderItemNode(
  node: ItemNode,
  comparsaId: number,
  drafts: VoteDraft[],
  context: JuradoContext,
  onSelect: (item: ScoringItem, value: number) => void,
  disabled: boolean,
): JSX.Element {
  const values = new Map<number, number>()
  for (const item of context.items) {
    const state = scoreStateForItem(comparsaId, item.id, drafts, context.votes)
    if (state) values.set(item.id, state.value)
  }
  const subtotal = calculateParentTotal(node, values)
  const score = scoreStateForItem(comparsaId, node.id, drafts, context.votes)
  const isParent = node.children.length > 0

  return (
    <div key={node.id} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-50">{node.nombre}</h3>
          <p className="text-sm text-slate-400">{isParent ? '?tem calculado por sub?tems' : '?tem puntuable ? escala 0 a 5'}</p>
        </div>
        {isParent && subtotal !== undefined ? <Badge tone="info">Subtotal visual: {subtotal}</Badge> : null}
      </div>
      {isParent ? (
        <div className="mt-4 space-y-3 pl-0 sm:pl-4">
          {node.children.map((child) => renderItemNode(child, comparsaId, drafts, context, onSelect, disabled))}
        </div>
      ) : (
        <VoteInput itemName={node.nombre} score={score} disabled={disabled} onSelect={(value) => onSelect(node, value)} />
      )}
    </div>
  )
}

export function JudgePage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const syncSummary = useSyncSummary()
  const connection = useConnectionStatus()
  const [cachedContext, setCachedContext] = useState<JuradoContext | undefined>()
  const [selectedComparsaId, setSelectedComparsaId] = useState<number | undefined>()
  const [drafts, setDrafts] = useState<VoteDraft[]>([])
  const [closeDrafts, setCloseDrafts] = useState<ComparsaCloseDraft[]>([])
  const [pendingVote, setPendingVote] = useState<PendingVoteSelection | null>(null)
  const [closeConfirm, setCloseConfirm] = useState<Comparsa | null>(null)
  const [busy, setBusy] = useState(false)

  const contextQuery = useQuery({
    queryKey: ['jurado-context'],
    queryFn: async () => {
      const context = await juradoApi.context()
      await saveJuradoContextCache(context)
      return context
    },
  })

  useEffect(() => {
    void getJuradoContextCache().then(setCachedContext)
  }, [contextQuery.error])

  useEffect(() => {
    const refreshLocal = (): void => {
      void Promise.all([getVoteDrafts(), getCloseDrafts()]).then(([nextDrafts, nextCloses]) => {
        setDrafts(nextDrafts)
        setCloseDrafts(nextCloses)
      })
    }
    refreshLocal()
    window.addEventListener(SYNC_EVENT_NAME, refreshLocal)
    return () => window.removeEventListener(SYNC_EVENT_NAME, refreshLocal)
  }, [])

  useEffect(() => {
    if (connection.apiReachable) {
      void processSyncQueue().then(() => queryClient.invalidateQueries({ queryKey: ['jurado-context'] }))
    }
  }, [connection.apiReachable, queryClient])

  const context = contextQuery.data ?? cachedContext
  const selectedComparsa = context?.comparsas.find((comparsa) => comparsa.id === selectedComparsaId) ?? context?.comparsas[0]

  useEffect(() => {
    if (!selectedComparsaId && context?.comparsas[0]) setSelectedComparsaId(context.comparsas[0].id)
  }, [context, selectedComparsaId])

  const tree = useMemo(() => buildItemTree(context?.items ?? []), [context?.items])

  if (!context) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Card>
          <h2 className="text-xl font-bold">No hay contexto de jurado disponible</h2>
          <p className="mt-2 text-slate-300">Necesitamos una sesi?n v?lida o datos previamente cacheados para operar sin conexi?n.</p>
          {contextQuery.error ? <p className="mt-3 text-sm text-rose-200">{contextQuery.error.message}</p> : null}
        </Card>
      </main>
    )
  }

  const night = context.assignment.night
  const close = selectedComparsa ? closeStatus(selectedComparsa.id, closeDrafts, context.closes) : undefined
  const missing = selectedComparsa ? missingScorableItems(selectedComparsa.id, context.items, drafts, context.votes) : []
  const pendingVoteDraftsForSelected = selectedComparsa
    ? drafts.filter((draft) => draft.comparsaId === selectedComparsa.id && draft.syncStatus !== 'SYNCED')
    : []
  const canCloseSelected = selectedComparsa && missing.length === 0 && pendingVoteDraftsForSelected.length === 0 && !close && night.status === 'open'

  const confirmVote = async (): Promise<void> => {
    if (!pendingVote) return
    setBusy(true)
    try {
      await enqueueVoteOperation({ comparsaId: pendingVote.comparsa.id, itemId: pendingVote.item.id, valor: pendingVote.value })
      setPendingVote(null)
      scheduleSync(100)
    } finally {
      setBusy(false)
    }
  }

  const confirmClose = async (): Promise<void> => {
    if (!closeConfirm) return
    setBusy(true)
    try {
      await enqueueCloseComparsaOperation({ comparsaId: closeConfirm.id })
      setCloseConfirm(null)
      scheduleSync(100)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[340px_1fr]">
      <aside className="space-y-4">
        <Card>
          <p className="text-sm text-slate-400">Noche asignada</p>
          <h2 className="text-2xl font-black text-slate-50">{night.name}</h2>
          <p className="mt-1 text-sm text-slate-300">Estado servidor: <span className="font-semibold">{night.status}</span></p>
          {auth.user ? <p className="mt-2 text-sm text-slate-400">Jurado: {auth.user.nombre}</p> : null}
        </Card>
        <PendingOperationsIndicator summary={syncSummary} />
        <ConflictBanner summary={syncSummary} />
        <Card>
          <h2 className="text-lg font-bold">Comparsas</h2>
          <div className="mt-3 space-y-2">
            {context.comparsas.map((comparsa) => {
              const progress = progressForComparsa(context, comparsa.id, drafts, closeDrafts)
              const active = selectedComparsa?.id === comparsa.id
              return (
                <button
                  key={comparsa.id}
                  type="button"
                  onClick={() => setSelectedComparsaId(comparsa.id)}
                  className={`w-full rounded-3xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carnival-gold ${active ? 'border-carnival-gold bg-yellow-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold">{comparsa.orden}. {comparsa.nombre}</span>
                    <Badge tone={progress.closed ? 'success' : progress.pending > 0 ? 'warning' : progress.confirmed > 0 ? 'info' : 'neutral'}>{progressLabel(progress)}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{progress.confirmed}/{progress.totalScorable} ?tems ? {progress.synced} en servidor</p>
                </button>
              )
            })}
          </div>
        </Card>
      </aside>

      <section className="space-y-4">
        {selectedComparsa ? (
          <>
            <Card className="border-carnival-gold/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-carnival-gold">Planilla de votaci?n</p>
                  <h2 className="mt-1 text-3xl font-black">{selectedComparsa.nombre}</h2>
                  <p className="mt-2 text-sm text-slate-300">Seleccion? una nota, revis? el resumen y confirm?. Una nota confirmada queda bloqueada aunque a?n est? pendiente de servidor.</p>
                </div>
                {close ? <SyncStatusBadge status={close} /> : null}
              </div>
              {night.status !== 'open' ? <p className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">La noche no est? abierta. El frontend no habilita nuevas confirmaciones.</p> : null}
            </Card>

            <div className="space-y-3">
              {tree.map((node) => renderItemNode(node, selectedComparsa.id, drafts, context, (item, value) => setPendingVote({ comparsa: selectedComparsa, item, value }), night.status !== 'open' || Boolean(close)))}
            </div>

            <Card>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold">Cierre de comparsa</h3>
                  {missing.length > 0 ? (
                    <p className="mt-1 text-sm text-yellow-100">Faltan puntuar: {missing.map((item) => item.nombre).join(', ')}</p>
                  ) : pendingVoteDraftsForSelected.length > 0 ? (
                    <p className="mt-1 text-sm text-yellow-100">La planilla est? completa localmente, pero hay votos pendientes de servidor. Sin eso NO cierres: primero sincronizamos.</p>
                  ) : close ? (
                    <p className="mt-1 text-sm text-emerald-100">La comparsa tiene cierre registrado.</p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-300">Todos los ?tems est?n completos y sincronizados.</p>
                  )}
                </div>
                <Button size="lg" disabled={!canCloseSelected} onClick={() => setCloseConfirm(selectedComparsa)}>Cerrar comparsa</Button>
              </div>
            </Card>
          </>
        ) : (
          <Card><p>No hay comparsas habilitadas para tu noche asignada.</p></Card>
        )}
      </section>

      <Modal
        open={Boolean(pendingVote)}
        title="Confirmar puntuaci?n"
        description="Esta acci?n bloquear? la nota en este dispositivo y se enviar? al servidor con un identificador idempotente. No es lo mismo que confirmaci?n final del servidor."
        confirmLabel="Confirmar nota"
        busy={busy}
        onConfirm={() => { void confirmVote() }}
        onCancel={() => setPendingVote(null)}
      >
        {pendingVote ? (
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-400">Comparsa</dt><dd className="font-bold text-slate-50">{pendingVote.comparsa.nombre}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-400">?tem</dt><dd className="font-bold text-slate-50">{pendingVote.item.nombre}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-400">Nota</dt><dd className="text-2xl font-black text-carnival-gold">{pendingVote.value}</dd></div>
          </dl>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(closeConfirm)}
        title="Cerrar comparsa"
        description="El cierre tambi?n es idempotente e irreversible desde la interfaz normal. Solo se habilita cuando los votos requeridos est?n confirmados por servidor."
        confirmLabel="Cerrar comparsa"
        danger
        busy={busy}
        onConfirm={() => { void confirmClose() }}
        onCancel={() => setCloseConfirm(null)}
      >
        {closeConfirm ? <p className="text-lg font-bold text-slate-50">{closeConfirm.nombre}</p> : null}
      </Modal>
    </main>
  )
}
