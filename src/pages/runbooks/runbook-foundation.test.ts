import { describe, expect, it, vi } from 'vitest'

vi.mock('utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

vi.mock('contexts/PermissionContext', () => ({
  usePermissions: () => ({
    hasPermission: () => false,
    loading: false,
    error: null,
  }),
}))

import { resolveProcessSelection } from 'pages/project-detail/DeploymentProcess'
import type { RunbookProcessContextValue } from 'pages/project-detail/step-editors/shared/RunbookProcessContext'
import {
  buildRunbookPath,
  buildRunbookProcessPath,
  buildRunbookRunsPath,
  buildRunbookSettingsPath,
  buildRunbooksPath,
  isRunbookPermissionError,
  parsePositiveId,
  resolveRunbookValidationField,
  validateRunbookMetadata,
} from './shared'

describe('Runbook process selection', () => {
  const project = { deploymentProcessId: 101 }
  const runbookContext: RunbookProcessContextValue = {
    runbookId: 22,
    projectId: 7,
    processId: 202,
    runbookName: 'Rotate certificate',
  }

  it('uses only the Runbook-owned process when Runbook context is present', () => {
    expect(resolveProcessSelection(project, runbookContext)).toEqual({
      processId: 202,
      projectId: 7,
      runbookId: 22,
      isRunbook: true,
    })
  })

  it('keeps the project deployment process when Runbook context is absent', () => {
    expect(resolveProcessSelection(project, null)).toEqual({
      processId: 101,
      projectId: null,
      runbookId: null,
      isRunbook: false,
    })
  })
})

describe('Runbook routes and metadata', () => {
  it('builds Runbook routes separately from project deployment routes', () => {
    expect(buildRunbooksPath('Spaces-1', 'Checkout')).toBe('/Spaces-1/projects/Checkout/operations/runbooks')
    expect(buildRunbookPath('Spaces-1', 'Checkout', 9)).toBe('/Spaces-1/projects/Checkout/operations/runbooks/9')
    expect(buildRunbookProcessPath('Spaces-1', 'Checkout', 9)).toBe('/Spaces-1/projects/Checkout/operations/runbooks/9/process')
    expect(buildRunbookRunsPath('Spaces-1', 'Checkout', 9)).toBe('/Spaces-1/projects/Checkout/operations/runbooks/9/runs')
    expect(buildRunbookSettingsPath('Spaces-1', 'Checkout', 9)).toBe('/Spaces-1/projects/Checkout/operations/runbooks/9/settings')
  })

  it('validates required and bounded metadata', () => {
    expect(validateRunbookMetadata({ name: '   ' })?.field).toBe('name')
    expect(validateRunbookMetadata({ name: 'Valid name', description: 'x'.repeat(4001) })?.field).toBe('description')
    expect(validateRunbookMetadata({
      name: 'Valid name',
      tags: Array.from({ length: 51 }, (_, index) => `tag-${index}`),
    })?.field).toBe('tags')
  })

  it('maps structured backend validation to the form field', () => {
    expect(resolveRunbookValidationField({
      message: 'already exists',
      validationCode: 'runbook-name-conflict',
      validationField: 'Runbook.Name',
    })).toBe('name')
  })

  it('distinguishes permission rejection from an unavailable access probe', () => {
    expect(isRunbookPermissionError({ message: 'denied', missingPermission: 'RunbookView' })).toBe(true)
    expect(isRunbookPermissionError({ message: 'Network unavailable' })).toBe(false)
  })

  it('accepts only positive integer route IDs', () => {
    expect(parsePositiveId('12')).toBe(12)
    expect(parsePositiveId('0')).toBeNull()
    expect(parsePositiveId('abc')).toBeNull()
  })
})
