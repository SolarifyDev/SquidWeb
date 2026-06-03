import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, type Mock } from 'vitest'
import DeploymentHistory from 'pages/project-detail/DeploymentHistory'
import { EventCategory, getEvents, type EventDto, type EventsPageDto } from 'pages/apis/events'

vi.mock('pages/apis/events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pages/apis/events')>()
  return { ...actual, getEvents: vi.fn() }
})

const mockGetEvents = getEvents as unknown as Mock

function ev(partial: Partial<EventDto>): EventDto {
  return {
    id: 1, category: EventCategory.DeploymentSucceeded, categoryName: 'Deployment succeeded',
    messageTemplate: 'Deploy to {Environment} succeeded for {Release}',
    referencesJson: '{"environment":"Production","release":"6.6.2"}',
    spaceId: 1, projectId: 3, releaseId: 9, deploymentId: 42, environmentId: 4, machineId: null,
    serverTaskId: 420, userId: 7, username: 'alice', establishedWith: 1, establishedWithName: 'Session cookie',
    userAgent: null, occurred: '2026-06-03T10:00:00Z', ...partial,
  }
}

function page(events: EventDto[], hasMore = false, nextCursor: number | null = null): EventsPageDto {
  return { events, hasMore, nextCursor }
}

function renderHistory() {
  return render(
    <MemoryRouter>
      <DeploymentHistory releaseId={9} releaseVersion="6.6.2" projectName="Checkout" basePath="/1/projects/Checkout" />
    </MemoryRouter>,
  )
}

beforeEach(() => mockGetEvents.mockReset())

describe('DeploymentHistory', () => {
  it('renders the generically-formatted message + actor for each event', async () => {
    mockGetEvents.mockResolvedValueOnce(page([
      ev({ id: 2, messageTemplate: 'Deploy to {Environment} succeeded for {Release}' }),
      ev({ id: 1, category: EventCategory.DocumentCreated, categoryName: 'Document created', messageTemplate: '{Document} was created', referencesJson: '{"documentType":"Release","name":"6.6.2"}', username: 'system' }),
    ]))

    renderHistory()

    expect(await screen.findByText('Deploy to Production succeeded for 6.6.2')).toBeInTheDocument()
    expect(screen.getByText("Release '6.6.2' was created")).toBeInTheDocument()
    expect(screen.getByText('alice')).toBeInTheDocument()
    // filtered to the release on the wire
    expect(mockGetEvents).toHaveBeenCalledWith(expect.objectContaining({ releaseId: 9 }))
  })

  it('shows the empty state when there are no events', async () => {
    mockGetEvents.mockResolvedValueOnce(page([]))
    renderHistory()
    expect(await screen.findByText(/No history available/i)).toBeInTheDocument()
  })

  it('surfaces a fetch error', async () => {
    mockGetEvents.mockRejectedValueOnce(new Error('boom'))
    renderHistory()
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })

  it('expands a row to reveal provenance + references on click', async () => {
    mockGetEvents.mockResolvedValueOnce(page([ev({ id: 5 })]))
    renderHistory()

    const row = await screen.findByText('Deploy to Production succeeded for 6.6.2')
    expect(screen.queryByText(/Established with:/)).not.toBeInTheDocument()

    fireEvent.click(row)

    expect(await screen.findByText(/Established with: Session cookie/)).toBeInTheDocument()
    expect(screen.getByText('View deployment')).toBeInTheDocument()
  })

  it('loads an older page via the keyset cursor and appends it', async () => {
    mockGetEvents
      .mockResolvedValueOnce(page([ev({ id: 20, messageTemplate: 'Deploy to {Environment} succeeded for {Release}' })], true, 20))
      .mockResolvedValueOnce(page([ev({ id: 10, messageTemplate: 'Deploy to {Environment} started for {Release}' })], false, null))

    renderHistory()

    const loadMore = await screen.findByRole('button', { name: /Load older events/i })
    fireEvent.click(loadMore)

    await waitFor(() => expect(screen.getByText('Deploy to Production started for 6.6.2')).toBeInTheDocument())
    // first page still present (appended, not replaced)
    expect(screen.getByText('Deploy to Production succeeded for 6.6.2')).toBeInTheDocument()
    // second call carried the cursor
    expect(mockGetEvents).toHaveBeenLastCalledWith(expect.objectContaining({ beforeId: 20 }))
  })
})
