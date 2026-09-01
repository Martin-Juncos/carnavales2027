import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'md' | 'lg'
  children: ReactNode
}

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-carnival-naranja-calido text-night-950 hover:bg-carnival-amarillo-brillante focus-visible:ring-carnival-naranja-calido',
  secondary: 'bg-carnival-azul-profundo text-white hover:bg-carnival-lila focus-visible:ring-carnival-azul-profundo border border-white/20',
  danger: 'bg-carnival-rojo-vibrante text-white hover:bg-rose-500 focus-visible:ring-carnival-rojo-vibrante',
  ghost: 'bg-transparent text-slate-200 hover:bg-white/10 focus-visible:ring-carnival-azul-profundo',
}

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  md: 'min-h-11 px-4 py-2 text-sm',
  lg: 'min-h-14 px-5 py-3 text-base',
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-night-950 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
