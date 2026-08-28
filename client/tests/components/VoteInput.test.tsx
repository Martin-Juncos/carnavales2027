import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VoteInput } from '../../src/features/voting/VoteInput'

describe('VoteInput', () => {
  it('offers a numeric select from 0 to 5', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<VoteInput itemName="Música" onSelect={onSelect} />)

    await user.selectOptions(screen.getByRole('combobox', { name: /seleccionar nota/i }), '4')

    expect(onSelect).toHaveBeenCalledWith(4)
    expect(screen.getByRole('option', { name: '0' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '5' })).toBeInTheDocument()
  })

  it('locks the control after local or server confirmation', () => {
    render(<VoteInput itemName="Música" score={{ value: 5, status: 'PENDING', operationId: 'op-1' }} onSelect={vi.fn()} />)

    expect(screen.getByRole('combobox', { name: /nota bloqueada/i })).toBeDisabled()
    expect(screen.getByText('Pendiente de sincronizar')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /seleccionar nota/i })).not.toBeInTheDocument()
  })
})
