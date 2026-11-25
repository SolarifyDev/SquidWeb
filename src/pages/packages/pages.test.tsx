import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SquidPackages from './index'

const navigate = vi.fn()
let canEdit = false

vi.mock('react-router-dom', async (importActual) => ({ ...(await importActual<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('contexts/PermissionContext', () => ({ usePermissions: () => ({ hasPermission: (p: string) => canEdit && p === 'FeedEdit' }) }))
vi.mock('pages/apis/builtInPackages', async (importActual) => ({
  ...(await importActual<typeof import('pages/apis/builtInPackages')>()),
  listBuiltInPackages: () => Promise.resolve({ feedId: 7, packages: [{ packageId: 'Acme.Web', versionCount: 3, lastPublishedDate: '2026-11-20T10:00:00Z' }] }),
  getPackageVersionRule: () => Promise.resolve({ feedId: 7, packageId: 'x', versionTemplate: '1.0.{counter}', isDefault: true }),
}))

describe('Squid packages page', () => {
  beforeEach(() => {
    navigate.mockReset()
    canEdit = false
  })

  it('listsPackages_AndOpensOne', async () => {
    render(<MemoryRouter><SquidPackages /></MemoryRouter>)

    fireEvent.click(await screen.findByText('Acme.Web'))

    expect(screen.getByText('3 versions')).toBeInTheDocument()
    expect(navigate).toHaveBeenCalledWith('/Spaces-1/library/packages/Acme.Web')
  })

  it('withoutFeedEdit_NoUploadArea', async () => {
    render(<MemoryRouter><SquidPackages /></MemoryRouter>)
    await screen.findByText('Acme.Web')

    expect(screen.queryByTestId('upload-panel')).toBeNull()
  })

  it('withFeedEdit_ShowsTheUploadArea', async () => {
    canEdit = true
    render(<MemoryRouter><SquidPackages /></MemoryRouter>)
    await screen.findByText('Acme.Web')

    expect(screen.getByTestId('upload-panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose folder' })).toBeInTheDocument()
  })
})
