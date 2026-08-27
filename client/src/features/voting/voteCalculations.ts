import type {
  ComparsaCloseDraft,
  JuradoContext,
  JurorNightProgress,
  ScoringItem,
  ServerComparsaClose,
  ServerVote,
  VoteDraft,
  VoteSyncStatus,
} from '../../types/domain'
import { closeDraftId, voteDraftId } from '../../offline/syncRepository'

export interface ItemNode extends ScoringItem {
  children: ItemNode[]
}

export interface ScoreState {
  value: number
  status: VoteSyncStatus
  serverReceivedAt?: string
  operationId?: string
}

export function buildItemTree(items: ScoringItem[]): ItemNode[] {
  const ordered = [...items].sort((left, right) => left.orden - right.orden || left.id - right.id)
  const nodes = new Map<number, ItemNode>(ordered.map((item) => [item.id, { ...item, children: [] }]))
  const roots: ItemNode[] = []

  for (const item of ordered) {
    const node = nodes.get(item.id)
    if (!node) continue
    if (item.parentItemId && nodes.has(item.parentItemId)) {
      nodes.get(item.parentItemId)?.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export function leafItems(items: ScoringItem[]): ScoringItem[] {
  const parentIds = new Set(items.map((item) => item.parentItemId).filter((id): id is number => id !== null))
  return items.filter((item) => !parentIds.has(item.id))
}

export function scoreStateForItem(
  comparsaId: number,
  itemId: number,
  drafts: VoteDraft[],
  serverVotes: ServerVote[],
): ScoreState | undefined {
  const draft = drafts.find((candidate) => candidate.id === voteDraftId(comparsaId, itemId))
  if (draft) {
    return {
      value: draft.valor,
      status: draft.syncStatus,
      operationId: draft.operationId,
      ...(draft.serverReceivedAt ? { serverReceivedAt: draft.serverReceivedAt } : {}),
    }
  }
  const vote = serverVotes.find((candidate) => candidate.comparsaId === comparsaId && candidate.itemId === itemId)
  if (!vote) return undefined
  return {
    value: vote.valor,
    status: 'SYNCED',
    serverReceivedAt: vote.serverReceivedAt,
    operationId: vote.operationUuid,
  }
}

export function calculateParentTotal(node: ItemNode, values: Map<number, number>): number | undefined {
  if (node.children.length === 0) return values.get(node.id)
  let total = 0
  for (const child of node.children) {
    const value = calculateParentTotal(child, values)
    if (value === undefined) return undefined
    total += value
  }
  return total
}

export function missingScorableItems(comparsaId: number, items: ScoringItem[], drafts: VoteDraft[], serverVotes: ServerVote[]): ScoringItem[] {
  return leafItems(items).filter((item) => !scoreStateForItem(comparsaId, item.id, drafts, serverVotes))
}

export function closeStatus(
  comparsaId: number,
  closeDrafts: ComparsaCloseDraft[],
  serverCloses: ServerComparsaClose[],
): VoteSyncStatus | undefined {
  const draft = closeDrafts.find((candidate) => candidate.id === closeDraftId(comparsaId))
  if (draft) return draft.syncStatus
  const serverClose = serverCloses.find((candidate) => candidate.comparsaId === comparsaId)
  return serverClose ? 'SYNCED' : undefined
}

export function progressForComparsa(
  context: JuradoContext,
  comparsaId: number,
  drafts: VoteDraft[],
  closeDrafts: ComparsaCloseDraft[],
): JurorNightProgress {
  const leaves = leafItems(context.items)
  const states = leaves.map((item) => scoreStateForItem(comparsaId, item.id, drafts, context.votes)).filter((state): state is ScoreState => state !== undefined)
  const status = closeStatus(comparsaId, closeDrafts, context.closes)
  return {
    comparsaId,
    totalScorable: leaves.length,
    confirmed: states.length,
    synced: states.filter((state) => state.status === 'SYNCED').length,
    pending: states.filter((state) => state.status === 'PENDING' || state.status === 'LOCAL' || state.status === 'SYNCING').length,
    conflicted: states.filter((state) => state.status === 'CONFLICT' || state.status === 'REJECTED').length,
    closed: status !== undefined,
    ...(status ? { closeStatus: status } : {}),
  }
}

export function progressLabel(progress: JurorNightProgress): string {
  if (progress.closed) return progress.closeStatus === 'SYNCED' ? 'Confirmada' : 'Cierre pendiente'
  if (progress.confirmed === 0) return 'Pendiente'
  if (progress.confirmed < progress.totalScorable) return 'En progreso'
  if (progress.pending > 0) return 'Completa local'
  if (progress.conflicted > 0) return 'Con conflicto'
  return 'Completa'
}
