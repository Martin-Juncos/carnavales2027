import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'md' | 'lg'
  children: ReactNode
}

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-carnival-naranja-calido text-night-950 shadow-[0_12px_30px_rgba(253,162,48,0.22)] hover:bg-carnival-amarillo-brillante focus-visible:ring-carnival-naranja-calido',
  secondary: 'border border-white/15 bg-white/10 text-white hover:border-carnival-naranja-calido/50 hover:bg-white/15 focus-visible:ring-carnival-naranja-calido',
  danger: 'bg-carnival-rojo-vibrante text-white shadow-[0_12px_30px_rgba(251,93,41,0.18)] hover:bg-rose-500 focus-visible:ring-carnival-rojo-vibrante',
  ghost: 'bg-transparent text-slate-200 hover:bg-white/10 focus-visible:ring-carnival-naranja-calido',
}

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  md: 'min-h-11 px-4 py-2 text-sm',
  lg: 'min-h-14 px-5 py-3 text-base',
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold transition disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-night-950 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
