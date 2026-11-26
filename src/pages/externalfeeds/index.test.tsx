import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import ExternalFeeds from './index'

const navigate = vi.fn()

vi.mock('react-router-dom', async (importActual) => ({ ...(await importActual<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('pages/apis/externalFeed', () => ({
  getExternalFeeds: () =>
    Promise.resolve({
      count: 2,
      externalFeeds: [
        { id: 1, feedType: 'BuiltIn', feedUri: '', username: '', name: 'Built-in feed', slug: 'built-in', packageAcquisitionLocationOptions: [], spaceId: 1 },
        { id: 2, feedType: 'Docker Container Registry', feedUri: 'https://index.docker.io', username: '', name: 'Docker Hub', slug: 'docker', packageAcquisitionLocationOptions: [], spaceId: 1 },
      ],
    }),
}))

describe('External feeds list', () => {
  it('builtInFeed_ShowsAsSquidPackages_WithoutActions_AndLinksToThePackagesPage', async () => {
    render(<MemoryRouter><ExternalFeeds /></MemoryRouter>)

    const name = await screen.findByText('Squid packages')
    const row = name.closest('[role="button"]') as HTMLElement

    expect(screen.getByTestId('builtin-badge')).toBeInTheDocument()
    expect(row.querySelector('.anticon-more')).toBeNull()

    fireEvent.click(row)

    expect(navigate).toHaveBeenCalledWith('/Spaces-1/library/packages')
  })

  it('otherFeeds_KeepTheirMenu', async () => {
    render(<MemoryRouter><ExternalFeeds /></MemoryRouter>)

    const row = (await screen.findByText('Docker Hub')).closest('[role="button"]') as HTMLElement

    expect(row.querySelector('.anticon-more')).not.toBeNull()
  })
})
