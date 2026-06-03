import type { MachineDto } from 'pages/apis/machine'
import { resolveMachineHealthState } from 'pages/deploymentTargets/index'

// healthStatus arrives from the API as a number (the serialized enum), even though the
// DTO types it as a string; the cast reproduces that runtime reality for the test.
function machine(opts: { isDisabled?: boolean; healthStatus?: string | number | null }): MachineDto {
  return {
    id: 1,
    name: 'm',
    isDisabled: opts.isDisabled ?? false,
    healthStatus: opts.healthStatus as MachineDto['healthStatus'],
  } as MachineDto
}

describe('resolveMachineHealthState', () => {
  it('maps numeric health to the server MachineHealthStatus enum', () => {
    // Unknown=0, Healthy=1, HasWarnings=2, Unhealthy=3, Unavailable=4
    expect(resolveMachineHealthState(machine({ healthStatus: 0 }))).toBe('Unknown')
    expect(resolveMachineHealthState(machine({ healthStatus: 1 }))).toBe('Healthy')
    expect(resolveMachineHealthState(machine({ healthStatus: 2 }))).toBe('Unhealthy')
    expect(resolveMachineHealthState(machine({ healthStatus: 3 }))).toBe('Unhealthy')
    expect(resolveMachineHealthState(machine({ healthStatus: 4 }))).toBe('Unavailable')
  })

  it('regression: an ENABLED but Unavailable(4) target is Unavailable, not Disabled', () => {
    expect(resolveMachineHealthState(machine({ isDisabled: false, healthStatus: 4 }))).toBe('Unavailable')
  })

  it('shows Disabled only when the machine is actually disabled (regardless of health)', () => {
    expect(resolveMachineHealthState(machine({ isDisabled: true, healthStatus: 1 }))).toBe('Disabled')
    expect(resolveMachineHealthState(machine({ isDisabled: true, healthStatus: 4 }))).toBe('Disabled')
  })

  it('maps string health (PascalCase enum names) correctly', () => {
    expect(resolveMachineHealthState(machine({ healthStatus: 'Unavailable' }))).toBe('Unavailable')
    expect(resolveMachineHealthState(machine({ healthStatus: 'Unhealthy' }))).toBe('Unhealthy')
    expect(resolveMachineHealthState(machine({ healthStatus: 'Healthy' }))).toBe('Healthy')
  })

  it('falls back to Unknown for null/absent health', () => {
    expect(resolveMachineHealthState(machine({ healthStatus: null }))).toBe('Unknown')
    expect(resolveMachineHealthState(machine({}))).toBe('Unknown')
  })
})
