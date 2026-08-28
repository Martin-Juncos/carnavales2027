import { useState, type InputHTMLAttributes } from 'react'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  toggleLabel?: string
}

export function PasswordInput({ className = '', toggleLabel = 'Mostrar u ocultar valor', ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`${className} pr-14`}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-2 my-auto inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carnival-gold"
        aria-label={toggleLabel}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? '🙈' : '👁️'}
      </button>
    </div>
  )
}
