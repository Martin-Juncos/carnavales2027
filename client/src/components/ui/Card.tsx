import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return <section className={`rounded-[1.75rem] border border-white/15 bg-white/[0.09] p-5 shadow-glow backdrop-blur-xl sm:p-6 ${className}`}>{children}</section>
}
