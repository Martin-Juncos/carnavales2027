import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NightCalendarCarousel } from '../../src/features/voting/NightCalendarCarousel'
import { calendarPartsFromDate } from '../../src/features/voting/nightDate'
import type { NightSummary } from '../../src/types/domain'

const nights: NightSummary[] = [
  { id: 1, name: 'Primera noche', status: 'open', fecha: '2027-09-03' },
  { id: 2, name: 'Segunda noche', status: 'draft', fecha: '2027-09-04' },
]

describe('NightCalendarCarousel', () => {
  it('renders calendar parts from the night date', () => {
    render(<NightCalendarCarousel nights={nights} onEnterNight={vi.fn()} />)

    expect(screen.getByText('Viernes')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getAllByText('Septiembre').length).toBeGreaterThan(0)
  })

  it('moves between cards with controls and enters the selected night', async () => {
    const user = userEvent.setup()
    const onEnterNight = vi.fn()
    render(<NightCalendarCarousel nights={nights} onEnterNight={onEnterNight} />)

    await user.click(screen.getByRole('button', { name: 'Noche siguiente' }))
    expect(screen.getByRole('option', { name: /Segunda noche/ })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('button', { name: 'Ingresar a esta noche' }))
    expect(onEnterNight).toHaveBeenCalledWith(2)
  })

  it('supports swipe gestures for touch selection', () => {
    render(<NightCalendarCarousel nights={nights} onEnterNight={vi.fn()} />)
    const carousel = screen.getByRole('listbox', { name: 'Carrusel de noches' })

    fireEvent.mouseDown(carousel, { clientX: 220 })
    fireEvent.mouseUp(carousel, { clientX: 120 })

    expect(screen.getByRole('option', { name: /Segunda noche/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('formats dates in Spanish without UTC day shifts', () => {
    expect(calendarPartsFromDate('2027-09-03')).toEqual({
      weekday: 'Viernes',
      day: '3',
      month: 'Septiembre',
    })
  })
})
