import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from 'utils/request'
import SquidPackageDetail, { VersionDetail } from './detail'

const getRecipes = vi.fn()

vi.mock('react-router-dom', async (importActual) => ({ ...(await importActual<typeof import('react-router-dom')>()), useParams: () => ({ packageId: '100%' }) }))
vi.mock('contexts/PermissionContext', () => ({ usePermissions: () => ({ hasPermission: () => true }) }))
vi.mock('pages/apis/builtInPackages', async (importActual) => ({
  ...(await importActual<typeof import('pages/apis/builtInPackages')>()),
  listBuiltInPackageVersions: () => Promise.resolve([]),
  listBuiltInPackages: () => Promise.resolve({ feedId: 7, packages: [] }),
  getPackageVersionRule: () => Promise.resolve({ feedId: 7, packageId: '100%', versionTemplate: '1.0.{counter}', isDefault: true }),
  getRecipeRecommendations: (...args: unknown[]) => getRecipes(...args),
}))

describe('package detail page', () => {
  it('usesTheRouteParamAsIs_ARawPercentSignDoesNotThrow_AndUploadsGoToThisPackage', async () => {
    render(<MemoryRouter><SquidPackageDetail /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: '100%' })).toBeInTheDocument()

    const input = screen.getByTestId('file-input') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [new File(['PK'], 'other.zip')], configurable: true })
    fireEvent.change(input)

    expect(screen.getByLabelText('Package id')).toHaveValue('100%')
  })
})

describe('version detail', () => {
  it('aBackendErrorShowsItsMessage', async () => {
    getRecipes.mockRejectedValue(new ApiError("Version '9.9.9' of package 'x' was not found", 404, 200))
    render(<VersionDetail packageId="x" version="9.9.9" />)

    expect(await screen.findByRole('alert')).toHaveTextContent("Version '9.9.9' of package 'x' was not found")
  })

  it('noRecipesYet_ShowsTheEmptyState', async () => {
    getRecipes.mockResolvedValue({ inspected: true, facts: { values: {} }, selection: { candidates: [], validKinds: [] } })
    render(<VersionDetail packageId="x" version="1.0.0" />)

    expect(await screen.findByText('No recipe matched yet')).toBeInTheDocument()
  })
})
