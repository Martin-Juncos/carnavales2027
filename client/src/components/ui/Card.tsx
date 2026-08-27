import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return <section className={`rounded-3xl border border-slate-800 bg-slate-900/72 p-4 shadow-lg ${className}`}>{children}</section>
}
