import type { ReactNode } from 'react'

interface BadgeProps {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  children: ReactNode
  className?: string
}

const tones: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'border-slate-600 bg-slate-800 text-slate-200',
  success: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200',
  warning: 'border-carnival-gold/60 bg-yellow-500/15 text-yellow-100',
  danger: 'border-carnival-coral/60 bg-rose-500/15 text-rose-100',
  info: 'border-carnival-cyan/60 bg-cyan-500/15 text-cyan-100',
}

export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]} ${className}`}>{children}</span>
}
