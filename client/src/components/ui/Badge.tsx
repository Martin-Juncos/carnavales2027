import type { ReactNode } from 'react'

interface BadgeProps {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  light?: boolean
  children: ReactNode
  className?: string
}

const tones: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'border-white/15 bg-white/10 text-slate-200',
  success: 'border-emerald-400/50 bg-emerald-400/15 text-emerald-100',
  warning: 'border-carnival-amarillo-brillante/60 bg-yellow-500/15 text-yellow-100',
  danger: 'border-carnival-rojo-vibrante/60 bg-rose-500/15 text-rose-100',
  info: 'border-carnival-azul-profundo/60 bg-cyan-500/15 text-cyan-100',
}

const lightTones: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'border-slate-400 bg-slate-200 text-slate-800',
  success: 'border-emerald-600/50 bg-emerald-100 text-emerald-900',
  warning: 'border-amber-500/60 bg-amber-100 text-amber-900',
  danger: 'border-rose-600/50 bg-rose-100 text-rose-900',
  info: 'border-sky-700/40 bg-sky-100 text-sky-900',
}

export function Badge({ tone = 'neutral', light = false, children, className = '' }: BadgeProps) {
  const toneClass = light ? lightTones[tone] : tones[tone]
  return <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold tracking-wide ${toneClass} ${className}`}>{children}</span>
}
