import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCalendar, FiClock, FiFlag } from 'react-icons/fi'
import { juradoApi } from '../../api/juradoApi'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { SyncStatusBadge } from '../../components/domain/SyncStatusBadge'
import { ApiClientError } from '../../api/apiClient'
import { useAuth } from '../auth/AuthProvider'
import {
  getJuradoContextCache,
  saveJuradoContextCache,
} from '../../offline/syncRepository'
import { newOperationId } from '../../offline/device'
import type { Comparsa, ComparsaCloseDraft, JuradoContext, ScoringItem, ServerComparsaClose, ServerVote, VoteDraft } from '../../types/domain'
import { buildItemTree, calculateParentTotal, closeStatus, missingScorableItems, progressForComparsa, progressLabel, scoreStateForItem, type ItemNode } from './voteCalculations'
import { NightCalendarCarousel } from './NightCalendarCarousel'
import { VoteInput } from './VoteInput'

interface PendingVoteSelection {
  comparsa: Comparsa
  item: ScoringItem
  value: number
}

const noVoteDrafts: VoteDraft[] = []
const noCloseDrafts: ComparsaCloseDraft[] = []

function mergeVotes(serverVotes: ServerVote[], confirmedVotes: ServerVote[]): ServerVote[] {
  const byOperation = new Map(serverVotes.map((vote) => [vote.operationUuid, vote]))
  for (const vote of confirmedVotes) byOperation.set(vote.operationUuid, vote)
  return Array.from(byOperation.values())
}

function mergeCloses(serverCloses: ServerComparsaClose[], confirmedCloses: ServerComparsaClose[]): ServerComparsaClose[] {
  const byOperation = new Map(serverCloses.map((close) => [close.operationUuid, close]))
  for (const close of confirmedCloses) byOperation.set(close.operationUuid, close)
  return Array.from(byOperation.values())
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
  const [cachedContext, setCachedContext] = useState<JuradoContext | undefined>()
  const [selectedNightId, setSelectedNightId] = useState<number | undefined>()
  const [selectedComparsaId, setSelectedComparsaId] = useState<number | undefined>()
  const [confirmedVotes, setConfirmedVotes] = useState<ServerVote[]>([])
  const [confirmedCloses, setConfirmedCloses] = useState<ServerComparsaClose[]>([])
  const [pendingVote, setPendingVote] = useState<PendingVoteSelection | null>(null)
  const [closeConfirm, setCloseConfirm] = useState<Comparsa | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine)
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
    const online = (): void => setBrowserOnline(true)
    const offline = (): void => setBrowserOnline(false)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [])

  useEffect(() => {
    setConfirmedVotes([])
    setConfirmedCloses([])
    setActionError(null)
  }, [selectedNightId])

  const rawContext = contextQuery.data ?? (cachedContext?.assignment.night.id === selectedNightId ? cachedContext : undefined)
  const context = useMemo(() => {
    if (!rawContext) return undefined
    return {
      ...rawContext,
      votes: mergeVotes(rawContext.votes, confirmedVotes),
      closes: mergeCloses(rawContext.closes, confirmedCloses),
    }
  }, [confirmedCloses, confirmedVotes, rawContext])
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
          <NightCalendarCarousel nights={nightsQuery.data ?? []} onEnterNight={setSelectedNightId} />
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
          <p className="mt-2 text-slate-300">Necesitamos una sesión válida o datos previamente cacheados para mostrar la última planilla conocida.</p>
          {cachedContext ? <Button className="mt-4" onClick={() => setSelectedNightId(cachedContext.assignment.night.id)}><FiClock size={18} aria-hidden="true" />Usar última noche cacheada</Button> : null}
          {contextQuery.error ? <p className="mt-3 text-sm text-rose-200">{contextQuery.error.message}</p> : null}
        </Card>
      </main>
    )
  }

  const night = context.assignment.night
  const close = selectedComparsa ? closeStatus(selectedComparsa.id, noCloseDrafts, context.closes) : undefined
  const missing = selectedComparsa ? missingScorableItems(selectedComparsa.id, context.items, noVoteDrafts, context.votes) : []
  const selectedIndex = selectedComparsa ? Math.max(0, context.comparsas.findIndex((comparsa) => comparsa.id === selectedComparsa.id)) : 0
  const wrapperBg = tabBackgrounds[selectedIndex % tabBackgrounds.length]
  const canCloseSelected = selectedComparsa && missing.length === 0 && !close && browserOnline && !busy

  const confirmVote = async (): Promise<void> => {
    if (!pendingVote) return
    if (!navigator.onLine) {
      setActionError('No hay conexión. Recuperá internet y volvé a confirmar la nota.')
      return
    }
    setBusy(true)
    setActionError(null)
    try {
      const created = await juradoApi.createVote({
        operationUuid: newOperationId(),
        comparsaId: pendingVote.comparsa.id,
        itemId: pendingVote.item.id,
        valor: pendingVote.value,
        clientCreatedAt: new Date().toISOString(),
      })
      setConfirmedVotes((current) => [...current, created])
      setPendingVote(null)
      await queryClient.invalidateQueries({ queryKey: ['jurado-context', selectedNightId] })
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === 'VOTE_ALREADY_CONFIRMED') {
        setPendingVote(null)
        setActionError('Esa puntuación ya estaba confirmada en el servidor. Actualizamos la planilla.')
        await queryClient.invalidateQueries({ queryKey: ['jurado-context', selectedNightId] })
      } else {
        setActionError(caught instanceof ApiClientError ? caught.message : 'No se pudo confirmar la nota. Verificá conexión y reintentá.')
      }
    } finally {
      setBusy(false)
    }
  }

  const confirmClose = async (): Promise<void> => {
    if (!closeConfirm) return
    if (!navigator.onLine) {
      setActionError('No hay conexión. Recuperá internet y volvé a cerrar la comparsa.')
      return
    }
    setBusy(true)
    setActionError(null)
    try {
      const created = await juradoApi.closeComparsa(closeConfirm.id, {
        operationUuid: newOperationId(),
        clientCreatedAt: new Date().toISOString(),
      })
      setConfirmedCloses((current) => [...current, created])
      setCloseConfirm(null)
      await queryClient.invalidateQueries({ queryKey: ['jurado-context', selectedNightId] })
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === 'COMPARSA_CLOSED') {
        setCloseConfirm(null)
        setActionError('La comparsa ya estaba cerrada en el servidor. Actualizamos la planilla.')
        await queryClient.invalidateQueries({ queryKey: ['jurado-context', selectedNightId] })
      } else {
        setActionError(caught instanceof ApiClientError ? caught.message : 'No se pudo cerrar la comparsa. Verificá conexión y reintentá.')
      }
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
              <Badge tone={browserOnline ? 'success' : 'warning'}>{browserOnline ? 'Con conexión' : 'Sin conexión'}</Badge>
            </div>
          </div>
          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setSelectedNightId(undefined)}><FiCalendar size={18} aria-hidden="true" />Cambiar noche</Button>
        </div>
      </Card>

      {actionError ? <Card className="border-rose-500/40 bg-rose-500/10"><p className="text-sm font-semibold text-rose-100" role="alert">{actionError}</p></Card> : null}

      <section className="rounded-[2rem] border-2 border-slate-950 bg-white/10 p-2 shadow-[0_10px_0_rgba(15,23,42,0.75)] backdrop-blur-md">
        <div className="flex gap-1 overflow-x-auto px-1 pt-1" role="tablist" aria-label="Comparsas de la noche">
          {context.comparsas.map((comparsa, index) => {
            const progress = progressForComparsa(context, comparsa.id, noVoteDrafts, noCloseDrafts)
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
              {tree.map((node) => renderItemNode(node, selectedComparsa.id, noVoteDrafts, context, (item, value) => setPendingVote({ comparsa: selectedComparsa, item, value }), Boolean(close) || busy || !browserOnline))}
            </div>

            <div className="mt-4 rounded-3xl border border-slate-300 bg-white/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold">Cierre de comparsa</h3>
                  {missing.length > 0 ? (
                    <p className="mt-1 text-sm font-semibold text-amber-700">Faltan puntuar: {missing.map((item) => item.nombre).join(', ')}</p>
                  ) : !browserOnline ? (
                    <p className="mt-1 text-sm font-semibold text-amber-700">Sin conexión no se puede cerrar. Recuperá internet y reintentá.</p>
                  ) : close ? (
                    <p className="mt-1 text-sm font-semibold text-emerald-700">La comparsa tiene cierre registrado.</p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-700">Todos los ítems están confirmados por servidor.</p>
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
        description="Esta acción envía la nota al servidor con un identificador idempotente. Si no hay conexión, no se confirma y podés reintentar."
        confirmLabel="Confirmar nota"
        busy={busy}
        confirmDisabled={!browserOnline}
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
        description="El cierre se confirma directamente contra el servidor y es irreversible desde la interfaz normal."
        confirmLabel="Cerrar comparsa"
        danger
        busy={busy}
        confirmDisabled={!browserOnline}
        onConfirm={() => { void confirmClose() }}
        onCancel={() => setCloseConfirm(null)}
      >
        {closeConfirm ? <p className="text-lg font-bold text-slate-50">{closeConfirm.nombre}</p> : null}
      </Modal>
    </main>
  )
}
