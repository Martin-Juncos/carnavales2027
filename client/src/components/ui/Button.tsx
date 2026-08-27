import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'md' | 'lg'
  children: ReactNode
}

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-carnival-gold text-night-950 hover:bg-yellow-300 focus-visible:ring-carnival-gold',
  secondary: 'bg-slate-800 text-slate-50 hover:bg-slate-700 focus-visible:ring-carnival-cyan border border-slate-600',
  danger: 'bg-carnival-coral text-white hover:bg-rose-500 focus-visible:ring-carnival-coral',
  ghost: 'bg-transparent text-slate-200 hover:bg-slate-800 focus-visible:ring-carnival-cyan',
}

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  md: 'min-h-11 px-4 py-2 text-sm',
  lg: 'min-h-14 px-5 py-3 text-base',
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-2xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-night-950 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
