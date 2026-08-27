import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VoteInput } from '../../src/features/voting/VoteInput'

describe('VoteInput', () => {
  it('offers large numeric buttons from 0 to 5', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<VoteInput itemName="M?sica" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: /nota 4/i }))

    expect(onSelect).toHaveBeenCalledWith(4)
    expect(screen.getByRole('button', { name: /nota 0/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /nota 5/i })).toBeEnabled()
  })

  it('locks the control after local or server confirmation', () => {
    render(<VoteInput itemName="M?sica" score={{ value: 5, status: 'PENDING', operationId: 'op-1' }} onSelect={vi.fn()} />)

    expect(screen.getByText('Nota bloqueada')).toBeInTheDocument()
    expect(screen.getByText('Pendiente de sincronizar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /nota 4/i })).not.toBeInTheDocument()
  })
})
