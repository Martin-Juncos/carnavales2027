import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCalendar, FiClock, FiFlag } from 'react-icons/fi'
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
  depth = 0,
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
    <div key={node.id}>
<div className={`flex flex-col gap-2 border-b border-slate-200/70 px-3 py-3 sm:flex-row sm:items-center sm:gap-3 ${depth > 0 ? 'bg-white/60' : 'bg-white/40'}`}>
        <div className="min-w-0 flex-1" style={{ paddingLeft: `${depth * 1.25}rem` }}>
          <h3 className={isParent ? 'text-base font-black text-slate-950' : 'text-base font-bold text-slate-900'}>{node.nombre}</h3>
          <p className="text-xs text-slate-600">{isParent ? 'Rubro calculado por subítems' : 'Ítem puntuable'}</p>
        </div>
        {isParent ? (
          <Badge tone="info" className="self-start sm:self-auto">Subtotal: {subtotal ?? '-'}</Badge>
        ) : (
          <VoteInput itemName={node.nombre} score={score} disabled={disabled} onSelect={(value) => onSelect(node, value)} />
        )}
      </div>
      {isParent ? (
        <div>
          {node.children.map((child) => renderItemNode(child, comparsaId, drafts, context, onSelect, disabled, depth + 1))}
        </div>
      ) : null}
    </div>
  )
}

const tabBackgrounds = [
  'bg-carnival-naranja-calido',
  'bg-blue-600',
  'bg-fuchsia-500',
  'bg-emerald-500',
  'bg-orange-500',
  'bg-cyan-400',
]
const tabForegrounds = [
  'text-night-950',
  'text-white',
  'text-white',
  'text-night-950',
  'text-night-950',
  'text-night-950',
]

function tabClass(index: number, active: boolean): string {
  const color = tabBackgrounds[index % tabBackgrounds.length]
  const foreground = tabForegrounds[index % tabForegrounds.length]
  return `min-h-14 min-w-36 rounded-t-3xl border-2 border-slate-950 px-4 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carnival-naranja-calido ${color} ${foreground} ${active ? 'translate-y-[2px] shadow-none' : 'opacity-80 shadow-[0_4px_0_rgba(15,23,42,0.75)] hover:opacity-100'}`
}

function nightStatusTone(status: JuradoContext['assignment']['night']['status']): 'success' | 'warning' | 'neutral' {
  if (status === 'open') return 'success'
  if (status === 'draft') return 'warning'
  return 'neutral'
}

export function JudgePage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const syncSummary = useSyncSummary()
  const connection = useConnectionStatus()
  const [cachedContext, setCachedContext] = useState<JuradoContext | undefined>()
  const [selectedNightId, setSelectedNightId] = useState<number | undefined>()
  const [selectedComparsaId, setSelectedComparsaId] = useState<number | undefined>()
  const [drafts, setDrafts] = useState<VoteDraft[]>([])
  const [closeDrafts, setCloseDrafts] = useState<ComparsaCloseDraft[]>([])
  const [pendingVote, setPendingVote] = useState<PendingVoteSelection | null>(null)
  const [closeConfirm, setCloseConfirm] = useState<Comparsa | null>(null)
  const [busy, setBusy] = useState(false)

  const nightsQuery = useQuery({
    queryKey: ['jurado-nights'],
    queryFn: () => juradoApi.nights(),
  })

  const contextQuery = useQuery({
    queryKey: ['jurado-context', selectedNightId],
    enabled: selectedNightId !== undefined,
    queryFn: async () => {
      const context = await juradoApi.nightContext(Number(selectedNightId))
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
      void processSyncQueue().then(() => queryClient.invalidateQueries({ queryKey: ['jurado-context', selectedNightId] }))
    }
  }, [connection.apiReachable, queryClient, selectedNightId])

  const context = contextQuery.data ?? (cachedContext?.assignment.night.id === selectedNightId ? cachedContext : undefined)
  const selectedComparsa = context?.comparsas.find((comparsa) => comparsa.id === selectedComparsaId) ?? context?.comparsas[0]

  useEffect(() => {
    setSelectedComparsaId(undefined)
  }, [selectedNightId])

  useEffect(() => {
    if (!selectedComparsaId && context?.comparsas[0]) setSelectedComparsaId(context.comparsas[0].id)
  }, [context, selectedComparsaId])

  const tree = useMemo(() => buildItemTree(context?.items ?? []), [context?.items])

  if (!selectedNightId) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Card>
          <p className="text-sm text-slate-400">Paso 1</p>
          <h2 className="text-2xl font-black">Elegí la noche que vas a votar</h2>
          <p className="mt-2 text-slate-300">El servidor valida igualmente que la noche exista y esté abierta antes de aceptar votos.</p>
          {nightsQuery.error ? <p className="mt-3 text-sm text-rose-200">{nightsQuery.error.message}</p> : null}
          {cachedContext ? <Button className="mt-4" variant="secondary" onClick={() => setSelectedNightId(cachedContext.assignment.night.id)}><FiClock size={18} aria-hidden="true" />Usar última noche cacheada</Button> : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(nightsQuery.data ?? []).map((night) => (
              <button
                key={night.id}
                type="button"
                onClick={() => setSelectedNightId(night.id)}
                className="rounded-3xl border border-white/20 bg-night-950/60 p-4 text-left transition hover:border-carnival-naranja-calido focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carnival-naranja-calido"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-400">Noche #{night.id}</p>
                    <h3 className="text-xl font-bold text-slate-50">{night.name}</h3>
                  </div>
                  <Badge tone={night.status === 'open' ? 'success' : 'warning'}>{night.status}</Badge>
                </div>
              </button>
            ))}
          </div>
          {nightsQuery.isLoading ? <p className="mt-4 text-sm text-slate-400">Cargando noches...</p> : null}
          {!nightsQuery.isLoading && (nightsQuery.data ?? []).length === 0 ? <p className="mt-4 text-sm text-slate-300">Todavía no hay noches creadas por Administración.</p> : null}
        </Card>
      </main>
    )
  }

  if (!context) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Card>
          <h2 className="text-xl font-bold">No hay contexto de jurado disponible</h2>
          <p className="mt-2 text-slate-300">Necesitamos una sesión válida o datos previamente cacheados para operar sin conexión.</p>
          {cachedContext ? <Button className="mt-4" onClick={() => setSelectedNightId(cachedContext.assignment.night.id)}><FiClock size={18} aria-hidden="true" />Usar última noche cacheada</Button> : null}
          {contextQuery.error ? <p className="mt-3 text-sm text-rose-200">{contextQuery.error.message}</p> : null}
        </Card>
      </main>
    )
  }

  const night = context.assignment.night
  const close = selectedComparsa ? closeStatus(selectedComparsa.id, closeDrafts, context.closes) : undefined
  const missing = selectedComparsa ? missingScorableItems(selectedComparsa.id, context.items, drafts, context.votes) : []
  const selectedIndex = selectedComparsa ? Math.max(0, context.comparsas.findIndex((comparsa) => comparsa.id === selectedComparsa.id)) : 0
  const wrapperBg = tabBackgrounds[selectedIndex % tabBackgrounds.length]
  const pendingVoteDraftsForSelected = selectedComparsa
    ? drafts.filter((draft) => draft.comparsaId === selectedComparsa.id && draft.syncStatus !== 'SYNCED')
    : []
  const canCloseSelected = selectedComparsa && missing.length === 0 && pendingVoteDraftsForSelected.length === 0 && !close

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
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-5">
<Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-heading text-lg text-carnival-naranja-calido">Planilla del jurado</p>
            <h2 className="mt-1 text-2xl font-black text-slate-50 sm:text-3xl">{night.name}</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-300">
              {auth.user ? <Badge tone="info">Jurado: {auth.user.nombre}</Badge> : null}
              <Badge tone={nightStatusTone(night.status)}>Estado: {night.status}</Badge>
              <Badge tone={connection.apiReachable ? 'success' : 'warning'}>{connection.label}</Badge>
            </div>
          </div>
          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setSelectedNightId(undefined)}><FiCalendar size={18} aria-hidden="true" />Cambiar noche</Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <PendingOperationsIndicator summary={syncSummary} />
        <ConflictBanner summary={syncSummary} />
      </div>

      <section className="rounded-[2rem] border-2 border-slate-950 bg-white/10 p-2 shadow-[0_10px_0_rgba(15,23,42,0.75)] backdrop-blur-md">
        <div className="flex gap-1 overflow-x-auto px-1 pt-1" role="tablist" aria-label="Comparsas de la noche">
          {context.comparsas.map((comparsa, index) => {
            const progress = progressForComparsa(context, comparsa.id, drafts, closeDrafts)
            const active = selectedComparsa?.id === comparsa.id
            return (
              <button
                key={comparsa.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedComparsaId(comparsa.id)}
                className={tabClass(index, active)}
              >
                <span>{comparsa.orden}. {comparsa.nombre}</span>
                <span className="mt-1 block text-xs font-semibold opacity-80">{progressLabel(progress)}</span>
              </button>
            )
          })}
        </div>

        <div className={`min-h-[28rem] rounded-b-[1.5rem] rounded-tr-[1.5rem] border-2 border-slate-950 p-3 text-slate-950 ${wrapperBg}`}>
        {selectedComparsa ? (
          <>
<div className="rounded-3xl border border-slate-300 bg-white/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Comparsa</p>
                  <h2 className="mt-1 text-2xl font-black sm:text-3xl">{selectedComparsa.nombre}</h2>
                  <p className="mt-2 text-sm text-slate-700">Elegí un puntaje de 0 a 5. Antes de fijarlo se abre una confirmación.</p>
                </div>
                {close ? <SyncStatusBadge status={close} /> : null}
              </div>
            </div>

            <div className={`mt-4 overflow-hidden rounded-3xl border border-slate-300 ${wrapperBg}`}>
              <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-300 bg-night-950 px-3 py-3 text-sm font-black uppercase tracking-[0.15em] text-white">
                <span>Rubro / ítem</span>
                <span>Puntaje</span>
              </div>
              {tree.map((node) => renderItemNode(node, selectedComparsa.id, drafts, context, (item, value) => setPendingVote({ comparsa: selectedComparsa, item, value }), Boolean(close)))}
            </div>

            <div className="mt-4 rounded-3xl border border-slate-300 bg-white/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold">Cierre de comparsa</h3>
                  {missing.length > 0 ? (
                    <p className="mt-1 text-sm font-semibold text-amber-700">Faltan puntuar: {missing.map((item) => item.nombre).join(', ')}</p>
                  ) : pendingVoteDraftsForSelected.length > 0 ? (
                    <p className="mt-1 text-sm font-semibold text-amber-700">La planilla está completa localmente, pero hay votos pendientes de servidor. Sin eso NO cierres: primero sincronizamos.</p>
                  ) : close ? (
                    <p className="mt-1 text-sm font-semibold text-emerald-700">La comparsa tiene cierre registrado.</p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-700">Todos los ítems están completos y sincronizados.</p>
                  )}
                </div>
                <Button size="lg" className="w-full sm:w-auto" disabled={!canCloseSelected} onClick={() => setCloseConfirm(selectedComparsa)}><FiFlag size={18} aria-hidden="true" />Cerrar comparsa</Button>
              </div>
            </div>
          </>
        ) : (
          <p className="p-6 font-semibold text-slate-50">No hay comparsas habilitadas para la noche seleccionada.</p>
        )}
        </div>
      </section>

      <Modal
        open={Boolean(pendingVote)}
        title="Confirmar puntuación"
        description="Esta acción bloqueará la nota en este dispositivo y se enviará al servidor con un identificador idempotente. No es lo mismo que confirmación final del servidor."
        confirmLabel="Confirmar nota"
        busy={busy}
        onConfirm={() => { void confirmVote() }}
        onCancel={() => setPendingVote(null)}
      >
        {pendingVote ? (
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-400">Comparsa</dt><dd className="font-bold text-slate-50">{pendingVote.comparsa.nombre}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-400">Ítem</dt><dd className="font-bold text-slate-50">{pendingVote.item.nombre}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-400">Nota</dt><dd className="text-2xl font-black text-carnival-naranja-calido">{pendingVote.value}</dd></div>
          </dl>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(closeConfirm)}
        title="Cerrar comparsa"
        description="El cierre también es idempotente e irreversible desde la interfaz normal. Solo se habilita cuando los votos requeridos están confirmados por servidor."
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
