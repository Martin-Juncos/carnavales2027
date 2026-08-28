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
    <div className="flex items-center justify-end gap-3">
      {score ? (
        <>
          <select
            aria-label={`Nota bloqueada para ${itemName}`}
            className="min-h-12 w-24 rounded-2xl border border-carnival-gold bg-carnival-gold px-3 text-center text-xl font-black text-night-950 disabled:opacity-100"
            value={score.value}
            disabled
          >
            <option value={score.value}>{score.value}</option>
          </select>
          <SyncStatusBadge status={score.status} />
        </>
      ) : (
        <select
          aria-label={`Seleccionar nota para ${itemName}`}
          className="min-h-12 w-28 rounded-2xl border border-slate-700 bg-slate-950 px-3 text-center text-lg font-bold text-slate-50 outline-none transition focus:border-carnival-gold focus:ring-2 focus:ring-carnival-gold/40 disabled:cursor-not-allowed disabled:opacity-50"
          value=""
          disabled={locked}
          onChange={(event) => {
            const value = Number(event.target.value)
            if (Number.isInteger(value)) onSelect(value)
          }}
        >
          <option value="" disabled>Puntaje</option>
          {values.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      )}
    </div>
  )
}
