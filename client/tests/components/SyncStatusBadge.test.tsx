import { render, screen } from '@testing-library/react'
import { SyncStatusBadge } from '../../src/components/domain/SyncStatusBadge'

describe('SyncStatusBadge', () => {
  it('uses text, not only color, to expose sync status', () => {
    render(<SyncStatusBadge status="CONFLICT" />)
    expect(screen.getByText('Conflicto')).toBeInTheDocument()
  })
})
