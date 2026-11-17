import { describe, it, expect } from 'vitest'
import { deploymentDisplayDate } from './projectProgression'

// The Squid API serialises ReleaseProgressionDeploymentDto.CreatedDate / ReleaseLifecycleProgressionDto.CreatedDate as "createdDate".
describe('deploymentDisplayDate', () => {
  it('uses the completion time of a finished deployment', () => {
    expect(deploymentDisplayDate({ completedTime: '2026-11-16T15:38:00Z', createdDate: '2026-11-16T15:30:00Z' })).toBe('2026-11-16T15:38:00Z')
  })

  it('falls back to the created date of a deployment still running', () => {
    expect(deploymentDisplayDate({ completedTime: null, createdDate: '2026-11-16T15:30:00Z' })).toBe('2026-11-16T15:30:00Z')
  })

  it('reads the field name the API actually sends for a running deployment', () => {
    const fromApi = JSON.parse('{"deploymentId":1,"state":"Executing","createdDate":"2026-11-16T15:30:00Z","completedTime":null}')

    expect(deploymentDisplayDate(fromApi)).toBe('2026-11-16T15:30:00Z')
  })
})
