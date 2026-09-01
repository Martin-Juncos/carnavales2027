import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

const mocks = vi.hoisted(() => ({
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
}))

vi.mock('./AuthProvider', () => ({
  useAuth: () => ({
    user: null,
    requestOtp: mocks.requestOtp,
    verifyOtp: mocks.verifyOtp,
  }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requestOtp.mockResolvedValue({ challengeId: '7cd336ef-b8b7-40a0-ac8e-cfb8c40c4358', expiresIn: 300 })
    mocks.verifyOtp.mockResolvedValue(undefined)
  })

  it('requests OTP with name, email and DNI, then shows the OTP modal', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><LoginPage /></MemoryRouter>)

    await user.type(screen.getByLabelText('Nombre'), 'Martin Juncos')
    await user.type(screen.getByLabelText('Email'), 'jurado@example.com')
    await user.type(screen.getByLabelText('DNI'), '25609038')
    await user.click(screen.getByRole('button', { name: 'Solicitar código' }))

    expect(mocks.requestOtp).toHaveBeenCalledWith({
      nombre: 'Martin Juncos',
      email: 'jurado@example.com',
      dni: '25609038',
    })
    expect(await screen.findByRole('dialog', { name: 'Confirmar autenticación' })).toBeInTheDocument()
  })

  it('allows showing and hiding the DNI password value', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><LoginPage /></MemoryRouter>)

    const dni = screen.getByLabelText('DNI')
    expect(dni).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Mostrar u ocultar DNI' }))
    expect(dni).toHaveAttribute('type', 'text')
  })

  it('does not render health status before authentication', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>)

    expect(screen.queryByText('Conectado')).not.toBeInTheDocument()
  })

  it('keeps only six numeric OTP digits when pasted', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><LoginPage /></MemoryRouter>)

    await user.type(screen.getByLabelText('Nombre'), 'Martin Juncos')
    await user.type(screen.getByLabelText('Email'), 'jurado@example.com')
    await user.type(screen.getByLabelText('DNI'), '25609038')
    await user.click(screen.getByRole('button', { name: 'Solicitar código' }))

    const otp = await screen.findByLabelText('Código OTP')
    fireEvent.change(otp, { target: { value: '12ab345678' } })

    expect(otp).toHaveValue('123456')
  })
})
