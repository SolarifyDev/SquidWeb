import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi, type Mock } from 'vitest'
import Deployments from 'pages/project-detail/Deployments'
import { getProjects } from 'pages/apis/project'
import { getProjectProgression, type ProjectProgression, type ReleaseProgression } from 'pages/apis/projectProgression'

vi.mock('pages/apis/project', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pages/apis/project')>()
  return { ...actual, getProjects: vi.fn() }
})

vi.mock('pages/apis/projectProgression', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pages/apis/projectProgression')>()
  return { ...actual, getProjectProgression: vi.fn() }
})

const mockGetProjects = getProjects as unknown as Mock
const mockGetProjectProgression = getProjectProgression as unknown as Mock

const DEFAULT_CHANNEL = { id: 1, name: 'Default' }
const HOTFIX_CHANNEL = { id: 2, name: 'Hotfix' }

function release(id: number, version: string, channel: { id: number; name: string }): ReleaseProgression {
  return {
    release: { id, version, createdDate: '2026-11-01T00:00:00Z', channelId: channel.id },
    channel,
    deployments: {},
    nextDeployments: [],
  }
}

function progression(channelReleaseCounts?: Record<number, number>): ProjectProgression {
  return {
    environments: [{ id: 10, name: 'Production' }],
    channelEnvironments: { 1: [10], 2: [10] },
    releases: [
      release(103, '1.0.3', DEFAULT_CHANNEL),
      release(102, '1.0.2', DEFAULT_CHANNEL),
      release(101, '1.0.1', DEFAULT_CHANNEL),
      release(201, '1.0.1-hotfix', HOTFIX_CHANNEL),
    ],
    channelReleaseCounts,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/Spaces-1/projects/web/deployments']}>
      <Routes>
        <Route path="/:spaceId/projects/:projectName/deployments" element={<Deployments />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockGetProjects.mockReset()
  mockGetProjectProgression.mockReset()
  mockGetProjects.mockResolvedValue({ projects: [{ id: 7, name: 'web', slug: 'web' }] })
})

describe('Deployments dashboard release window', () => {
  it('shows "x of y" with a link to the releases list only for channels with hidden releases', async () => {
    mockGetProjectProgression.mockResolvedValue(progression({ 1: 4000, 2: 1 }))

    renderPage()

    expect(await screen.findByText('Showing 3 of 4,000 releases')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'View all releases' })).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'View all releases' })).toHaveAttribute('href', '/Spaces-1/projects/web/releases')
    expect(mockGetProjectProgression).toHaveBeenCalledWith(7)
  })

  it('shows no footer when the backend reports no totals', async () => {
    mockGetProjectProgression.mockResolvedValue(progression(undefined))

    renderPage()

    expect(await screen.findByText('1.0.3')).toBeInTheDocument()
    expect(screen.queryByText(/View all releases/)).not.toBeInTheDocument()
  })
})
