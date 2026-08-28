import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  confirmDisabled?: boolean
  children?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}

export function Modal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  danger = false,
  busy = false,
  confirmDisabled = false,
  children,
  onConfirm,
  onCancel,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    panelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 isolate flex items-end justify-center bg-black/70 p-4 sm:items-center" role="presentation">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-description' : undefined}
        tabIndex={-1}
        className="relative z-10 w-full max-w-lg rounded-3xl border border-slate-700 bg-night-900 p-5 shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carnival-gold"
      >
        <h2 id="modal-title" className="text-xl font-bold text-slate-50">{title}</h2>
        {description ? <p id="modal-description" className="mt-2 text-sm text-slate-300">{description}</p> : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button type="button" variant="secondary" size="lg" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
          <Button type="button" variant={danger ? 'danger' : 'primary'} size="lg" onClick={onConfirm} disabled={busy || confirmDisabled}>{busy ? 'Procesando...' : confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
