import { KeyboardEvent, MouseEvent, PointerEvent, useMemo, useState } from 'react'
import { FiCalendar, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import type { NightSummary } from '../../types/domain'
import { calendarPartsFromDate } from './nightDate'

interface NightCalendarCarouselProps {
  nights: NightSummary[]
  onEnterNight: (nightId: number) => void
}

function statusTone(status: NightSummary['status']): 'success' | 'warning' | 'neutral' {
  if (status === 'open') return 'success'
  if (status === 'draft') return 'warning'
  return 'neutral'
}

function cardPositionClass(position: number): string {
  if (position === 0) return 'z-30 translate-x-0 scale-100 opacity-100'
  if (position === 1) return 'z-20 translate-x-10 scale-95 opacity-80 sm:translate-x-16'
  if (position === -1) return 'z-20 -translate-x-10 scale-95 opacity-80 sm:-translate-x-16'
  if (position === 2) return 'z-10 translate-x-16 scale-90 opacity-40 sm:translate-x-28'
  if (position === -2) return 'z-10 -translate-x-16 scale-90 opacity-40 sm:-translate-x-28'
  return 'pointer-events-none scale-90 opacity-0'
}

export function NightCalendarCarousel({ nights, onEnterNight }: NightCalendarCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [dragStartX, setDragStartX] = useState<number | null>(null)
  const activeNight = nights[activeIndex]
  const activeDate = useMemo(() => activeNight ? calendarPartsFromDate(activeNight.fecha) : undefined, [activeNight])

  const goTo = (nextIndex: number): void => {
    setActiveIndex(Math.min(Math.max(nextIndex, 0), nights.length - 1))
  }

  const previous = (): void => goTo(activeIndex - 1)
  const next = (): void => goTo(activeIndex + 1)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      previous()
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      next()
    }
    if (event.key === 'Enter' && activeNight) {
      event.preventDefault()
      onEnterNight(activeNight.id)
    }
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    completeDrag(event.clientX)
  }

  const onMouseUp = (event: MouseEvent<HTMLDivElement>): void => {
    completeDrag(event.clientX)
  }

  const completeDrag = (endX: number): void => {
    if (dragStartX === null) return
    const distance = endX - dragStartX
    setDragStartX(null)
    if (Math.abs(distance) < 42) return
    if (distance < 0) next()
    else previous()
  }

  if (nights.length === 0) return null

  return (
    <section className="mt-6" aria-label="Noches disponibles para votar">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={previous} disabled={activeIndex === 0} aria-label="Noche anterior">
          <FiChevronLeft size={20} aria-hidden="true" />Anterior
        </Button>
        <p className="text-sm font-semibold text-slate-300" aria-live="polite">{activeIndex + 1} de {nights.length}</p>
        <Button type="button" variant="secondary" onClick={next} disabled={activeIndex === nights.length - 1} aria-label="Noche siguiente">
          Siguiente<FiChevronRight size={20} aria-hidden="true" />
        </Button>
      </div>

      <div
        className="relative mx-auto mt-5 h-[24rem] max-w-xl touch-pan-y select-none outline-none"
        role="listbox"
        aria-label="Carrusel de noches"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => setDragStartX(event.clientX)}
        onPointerCancel={() => setDragStartX(null)}
        onPointerUp={onPointerUp}
        onMouseDown={(event) => setDragStartX(event.clientX)}
        onMouseUp={onMouseUp}
      >
        {nights.map((night, index) => {
          const position = index - activeIndex
          const date = calendarPartsFromDate(night.fecha)
          const active = index === activeIndex
          return (
            <button
              key={night.id}
              type="button"
              role="option"
              aria-selected={active}
              aria-label={`${night.name}, ${date.weekday} ${date.day} de ${date.month}, estado ${night.status}`}
              onClick={() => goTo(index)}
              className={`absolute left-1/2 top-0 flex h-[22rem] w-[16rem] -translate-x-1/2 flex-col overflow-hidden rounded-[2rem] border-2 border-slate-950 bg-slate-50 text-night-950 shadow-[0_14px_0_rgba(15,23,42,0.75)] transition duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-carnival-naranja-calido sm:w-[18rem] ${cardPositionClass(position)}`}
            >
              <span className="flex items-center justify-center gap-2 bg-carnival-naranja-calido px-4 py-4 text-lg font-black uppercase tracking-[0.18em]">
                <FiCalendar size={20} aria-hidden="true" />{date.weekday}
              </span>
              <span className="flex flex-1 flex-col items-center justify-center px-5 text-center">
                <span className="font-heading text-[7rem] leading-none text-night-950">{date.day}</span>
                <span className="mt-2 text-2xl font-black capitalize">{date.month}</span>
                <span className="mt-5 text-base font-bold">{night.name}</span>
                <Badge tone={statusTone(night.status)} className="mt-3">{night.status}</Badge>
              </span>
            </button>
          )
        })}
      </div>

      {activeNight && activeDate ? (
        <div className="mx-auto mt-2 max-w-sm text-center">
          <p className="text-sm text-slate-300">Seleccionaste {activeNight.name}: {activeDate.weekday} {activeDate.day} de {activeDate.month}.</p>
          <Button type="button" size="lg" className="mt-4 w-full" onClick={() => onEnterNight(activeNight.id)}>
            <FiCalendar size={20} aria-hidden="true" />Ingresar a esta noche
          </Button>
        </div>
      ) : null}
    </section>
  )
}
