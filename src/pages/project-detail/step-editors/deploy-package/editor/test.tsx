import React, { createRef } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { DeployPackageEditor } from '../DeployPackageEditor'
import type { StepEditorHandle } from '../../shared/StepEditorTypes'
import { getExternalFeeds, searchExternalFeedPackages } from 'pages/apis/externalFeed'
import { createDeploymentStep, updateDeploymentStep } from 'pages/apis/deploymentProcess'

vi.mock('pages/apis/externalFeed', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pages/apis/externalFeed')>()
  return {
    ...actual,
    getExternalFeeds: vi.fn(),
    searchExternalFeedPackages: vi.fn(),
  }
})

vi.mock('pages/apis/deploymentProcess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pages/apis/deploymentProcess')>()
  return {
    ...actual,
    createDeploymentStep: vi.fn(),
    updateDeploymentStep: vi.fn(),
  }
})

vi.mock('../../shared/TargetTagSelect', () => ({
  TargetTagSelect: ({
    value,
    onChange,
  }: {
    value: string[]
    onChange: (tags: string[]) => void
  }) => (
    <div>
      <button type="button" onClick={() => onChange(value.length ? value : ['web'])}>
        ensure-target-role
      </button>
      <span data-testid="target-roles">{value.join(',')}</span>
    </div>
  ),
}))

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>()
  return {
    ...actual,
    message: {
      ...actual.message,
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
  }
})

const mockGetExternalFeeds = getExternalFeeds as unknown as Mock
const mockSearchExternalFeedPackages = searchExternalFeedPackages as unknown as Mock
const mockCreateDeploymentStep = createDeploymentStep as unknown as Mock
const mockUpdateDeploymentStep = updateDeploymentStep as unknown as Mock

function renderEditor(onSave = vi.fn()) {
  const ref = createRef<StepEditorHandle>()
  const view = render(
    <DeployPackageEditor
      ref={ref}
      step={null}
      processId={11}
      projectId={3}
      spaceId="1"
      stepIndex={0}
      onSave={onSave}
    />,
  )
  return { ref, onSave, ...view }
}

function getPackageSection() {
  const label = screen.getByText('Package ID')
  const section = label.parentElement
  if (!section) throw new Error('Package ID section missing')
  return section
}

function getPackageInput() {
  const section = getPackageSection()
  const input = section.querySelector('input')
  if (!input) throw new Error('Package input missing')
  return input as HTMLInputElement
}

async function selectFeed(feedName = 'NuGet Feed') {
  await waitFor(() => expect(mockGetExternalFeeds).toHaveBeenCalled())

  const packageSection = screen.getByText('Package Feed').parentElement
  if (!packageSection) throw new Error('Package Feed section missing')

  const feedCombobox = within(packageSection).getByRole('combobox')
  fireEvent.mouseDown(feedCombobox)

  const option = await screen.findByText(feedName)
  fireEvent.click(option)

  await waitFor(() => {
    expect(within(packageSection).getByText(feedName)).toBeInTheDocument()
  })
}


function getDropdownOption(text: string) {
  const options = screen.getAllByText(text)
  const option = options.find((node) => node.closest('.ant-select-item-option-content') || node.closest('.ant-select-item'))
  if (!option) {
    // fallback: first visible match
    return options[0]
  }
  return option
}

async function expectOptionVisible(text: string) {
  await waitFor(() => {
    const matches = screen.getAllByText(text)
    expect(matches.length).toBeGreaterThan(0)
  })
}

async function typePackageQuery(value: string) {
  const packageInput = getPackageInput()
  // Enable interaction after feed selection
  expect(packageInput).not.toBeDisabled()
  fireEvent.mouseDown(packageInput)
  fireEvent.focus(packageInput)
  fireEvent.change(packageInput, { target: { value } })
  // antd Select/AutoComplete may listen to input event as well
  fireEvent.input(packageInput, { target: { value } })
  return packageInput
}

beforeEach(() => {
  vi.useRealTimers()
  mockGetExternalFeeds.mockReset()
  mockSearchExternalFeedPackages.mockReset()
  mockCreateDeploymentStep.mockReset()
  mockUpdateDeploymentStep.mockReset()

  mockGetExternalFeeds.mockResolvedValue({
    count: 1,
    externalFeeds: [
      {
        id: 7,
        feedType: 'NuGet',
        feedUri: 'https://feed.example',
        username: '',
        name: 'NuGet Feed',
        slug: 'nuget-feed',
        packageAcquisitionLocationOptions: [],
        spaceId: 1,
      },
    ],
  })

  mockCreateDeploymentStep.mockImplementation(async ({ step }) => ({
    ...step,
    id: 99,
    createdAt: '2026-01-01T00:00:00Z',
  }))
})

describe('DeployPackageEditor package search contract', () => {
  it('maps API string packages into options', async () => {
    mockSearchExternalFeedPackages.mockResolvedValue({
      packages: ['Acme.Web', 'Acme.Worker'],
    })

    renderEditor()
    await selectFeed()
    await typePackageQuery('Acme')

    await waitFor(() => {
      expect(mockSearchExternalFeedPackages).toHaveBeenCalledWith(
        expect.objectContaining({ feedId: 7, query: 'Acme', take: 20 }),
      )
    })

    await expectOptionVisible('Acme.Web')
    await expectOptionVisible('Acme.Worker')
  })

  it('saves selected package id as string', async () => {
    mockSearchExternalFeedPackages.mockResolvedValue({
      packages: ['Acme.Web', 'Acme.Worker'],
    })

    const { ref, onSave } = renderEditor()
    await selectFeed()
    await typePackageQuery('Acme')

    await expectOptionVisible('Acme.Web')
    fireEvent.click(getDropdownOption('Acme.Web'))

    fireEvent.click(screen.getByRole('button', { name: 'ensure-target-role' }))

    await act(async () => {
      await ref.current?.save()
    })

    await waitFor(() => expect(mockCreateDeploymentStep).toHaveBeenCalled())
    const command = mockCreateDeploymentStep.mock.calls[0][0]
    const packageProp = command.step.actions[0].properties.find(
      (property: { propertyName: string }) => property.propertyName === 'Squid.Action.Package.PackageId',
    )
    expect(packageProp?.propertyValue).toBe('Acme.Web')
    expect(onSave).toHaveBeenCalled()
  })

  it('allows manual package id when API returns empty', async () => {
    mockSearchExternalFeedPackages.mockResolvedValue({ packages: [] })

    const { ref } = renderEditor()
    await selectFeed()
    await typePackageQuery('custom/archive')

    fireEvent.click(screen.getByRole('button', { name: 'ensure-target-role' }))

    await act(async () => {
      await ref.current?.save()
    })

    await waitFor(() => expect(mockCreateDeploymentStep).toHaveBeenCalled())
    const command = mockCreateDeploymentStep.mock.calls[0][0]
    const packageProp = command.step.actions[0].properties.find(
      (property: { propertyName: string }) => property.propertyName === 'Squid.Action.Package.PackageId',
    )
    expect(packageProp?.propertyValue).toBe('custom/archive')
  })

  it('ignores stale search responses', async () => {
    let resolveFirst: ((value: { packages: string[] }) => void) | undefined
    const firstPromise = new Promise<{ packages: string[] }>((resolve) => {
      resolveFirst = resolve
    })

    mockSearchExternalFeedPackages
      .mockImplementationOnce(() => firstPromise)
      .mockResolvedValueOnce({ packages: ['Latest.Only'] })

    renderEditor()
    await selectFeed()

    await typePackageQuery('old')
    await waitFor(() => expect(mockSearchExternalFeedPackages).toHaveBeenCalledTimes(1))

    await typePackageQuery('new')
    await waitFor(() => expect(mockSearchExternalFeedPackages).toHaveBeenCalledTimes(2))

    await expectOptionVisible('Latest.Only')

    await act(async () => {
      resolveFirst?.({ packages: ['Stale.Package'] })
    })

    await waitFor(() => {
      expect(screen.queryByText('Stale.Package')).not.toBeInTheDocument()
    })
    await expectOptionVisible('Latest.Only')
  })

  it('ignores in-flight package search after feed switch', async () => {
    mockGetExternalFeeds.mockResolvedValue({
      count: 2,
      externalFeeds: [
        {
          id: 7,
          feedType: 'NuGet',
          feedUri: 'https://feed.example',
          username: '',
          name: 'NuGet Feed',
          slug: 'nuget-feed',
          packageAcquisitionLocationOptions: [],
          spaceId: 1,
        },
        {
          id: 8,
          feedType: 'NuGet',
          feedUri: 'https://feed-b.example',
          username: '',
          name: 'Other Feed',
          slug: 'other-feed',
          packageAcquisitionLocationOptions: [],
          spaceId: 1,
        },
      ],
    })

    let resolveFirst: ((value: { packages: string[] }) => void) | undefined
    const firstPromise = new Promise<{ packages: string[] }>((resolve) => {
      resolveFirst = resolve
    })
    mockSearchExternalFeedPackages.mockImplementationOnce(() => firstPromise)

    renderEditor()
    await selectFeed('NuGet Feed')
    await typePackageQuery('Acme')

    await waitFor(() => expect(mockSearchExternalFeedPackages).toHaveBeenCalledTimes(1))

    await selectFeed('Other Feed')

    await act(async () => {
      resolveFirst?.({ packages: ['Stale.From.FeedA'] })
    })

    // Give a microtask turn for the stale response to apply if the guard is broken.
    await act(async () => {
      await Promise.resolve()
    })

    const packageInput = getPackageInput()
    expect(packageInput.value).toBe('')
    fireEvent.mouseDown(packageInput)
    fireEvent.focus(packageInput)

    await waitFor(() => {
      expect(screen.queryByText('Stale.From.FeedA')).not.toBeInTheDocument()
    })
  })
})
