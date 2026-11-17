import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ReleaseWindowFooter, summarizeReleaseWindow } from './ReleaseWindowFooter'

describe('summarizeReleaseWindow', () => {
  it('returns null when the channel total is unknown (older backend)', () => {
    expect(summarizeReleaseWindow(3, undefined)).toBeNull()
  })

  it('returns null when every release of the channel is already shown', () => {
    expect(summarizeReleaseWindow(2, 2)).toBeNull()
  })

  it('summarizes shown vs total when the dashboard shows only a recent window', () => {
    expect(summarizeReleaseWindow(5, 5000)).toEqual({ shown: 5, total: 5000 })
  })
})

describe('ReleaseWindowFooter', () => {
  it('links to the full releases list when releases are hidden', () => {
    render(
      <MemoryRouter>
        <ReleaseWindowFooter shown={5} total={5000} releasesPath="/Spaces-1/projects/web/releases" />
      </MemoryRouter>,
    )

    expect(screen.getByText('Showing 5 of 5,000 releases')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View all releases' })).toHaveAttribute('href', '/Spaces-1/projects/web/releases')
  })

  it('renders nothing when all releases are shown', () => {
    const { container } = render(
      <MemoryRouter>
        <ReleaseWindowFooter shown={2} total={2} releasesPath="/Spaces-1/projects/web/releases" />
      </MemoryRouter>,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
