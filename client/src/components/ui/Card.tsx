import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return <section className={`rounded-3xl border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-md ${className}`}>{children}</section>
}
