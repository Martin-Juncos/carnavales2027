import { Button } from '../../components/ui/Button'
import { SyncStatusBadge } from '../../components/domain/SyncStatusBadge'
import type { ScoreState } from './voteCalculations'

interface VoteInputProps {
  itemName: string
  score?: ScoreState | undefined
  disabled?: boolean
  onSelect: (value: number) => void
}

const values = [0, 1, 2, 3, 4, 5]

export function VoteInput({ itemName, score, disabled = false, onSelect }: VoteInputProps) {
  const locked = Boolean(score) || disabled
  return (
    <div className="mt-3">
      {score ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950 p-3">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-carnival-gold text-2xl font-black text-night-950" aria-label={`Nota confirmada ${score.value}`}>{score.value}</span>
          <div>
            <p className="text-sm font-semibold text-slate-100">Nota bloqueada</p>
            <p className="text-xs text-slate-400">No se puede modificar desde la interfaz normal.</p>
          </div>
          <SyncStatusBadge status={score.status} />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="group" aria-label={`Seleccionar nota para ${itemName}`}>
          {values.map((value) => (
            <Button
              key={value}
              type="button"
              variant="secondary"
              size="lg"
              disabled={locked}
              aria-label={`Confirmar nota ${value} para ${itemName}`}
              onClick={() => onSelect(value)}
              className="text-2xl font-black"
            >
              {value}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
