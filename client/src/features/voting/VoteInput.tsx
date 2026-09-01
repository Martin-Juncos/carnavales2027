import { SyncStatusBadge } from '../../components/domain/SyncStatusBadge'
import type { ScoreState } from './voteCalculations'

interface VoteInputProps {
  itemName: string
  score?: ScoreState | undefined
  disabled?: boolean
  className?: string
  onSelect: (value: number) => void
}

const values = [0, 1, 2, 3, 4, 5]

export function VoteInput({ itemName, score, disabled = false, className = '', onSelect }: VoteInputProps) {
  const locked = Boolean(score) || disabled
  return (
    <div className={`flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end ${className}`}>
      {score ? (
        <>
          <select
            aria-label={`Nota bloqueada para ${itemName}`}
            className="min-h-12 w-24 flex-shrink-0 rounded-2xl border border-carnival-naranja-calido bg-carnival-naranja-calido px-3 text-center text-xl font-black text-night-950 disabled:opacity-100"
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
          className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/25 bg-night-950/60 px-3 text-center text-lg font-bold text-slate-50 outline-none transition focus:border-carnival-naranja-calido focus:ring-2 focus:ring-carnival-naranja-calido/40 disabled:cursor-not-allowed disabled:opacity-50 sm:w-28 sm:flex-none"
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
