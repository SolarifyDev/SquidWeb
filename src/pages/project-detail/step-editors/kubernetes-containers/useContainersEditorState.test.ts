import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { serializeToStep, useContainersEditorState, validateIngressRules } from './useContainersEditorState'
import { defaultEditorState } from './types'
import type { IngressRule } from './types'
import type { DeploymentStepDto } from 'pages/apis/deploymentProcess'

const ruleWithBackend = (host: string): IngressRule => ({
  host,
  paths: [{ path: '/', pathType: 'Prefix', backend: { serviceName: 'web', servicePort: '80' } }],
})

describe('validateIngressRules', () => {
  it('rejects when there is no rule with a service backend', () => {
    expect(validateIngressRules([])).toMatch(/at least one ingress rule/i)
    expect(validateIngressRules([{ host: 'a.com', paths: [] }])).toMatch(/at least one ingress rule/i)
  })

  it('rejects a rule with a backend but an empty host (would become a cluster-wide catch-all)', () => {
    expect(validateIngressRules([ruleWithBackend('')])).toMatch(/must specify a host/i)
    expect(validateIngressRules([ruleWithBackend('   ')])).toMatch(/must specify a host/i)
  })

  it('accepts a rule with a concrete host', () => {
    expect(validateIngressRules([ruleWithBackend('app.example.com')])).toBeNull()
  })

  it('accepts a host expressed as a variable template', () => {
    expect(validateIngressRules([ruleWithBackend('#{IngressBaseDomainName}')])).toBeNull()
  })
})

describe('serializeToStep — standalone ingress step', () => {
  it('writes namespace and the rule host under the exact keys the backend reads', () => {
    const state = {
      ...defaultEditorState(),
      stepName: 'Deploy ingress',
      namespace: 'squid-web-prd',
      ingressRules: [ruleWithBackend('squid-deploy.solarifyai.com')],
    }

    const step = serializeToStep(state, 1, undefined, 'Squid.KubernetesDeployIngress')
    const props = step.actions[0].properties
    const ns = props.find((p) => p.propertyName === 'Squid.Action.KubernetesContainers.Namespace')
    const rules = props.find((p) => p.propertyName === 'Squid.Action.KubernetesContainers.IngressRules')

    expect(ns?.propertyValue).toBe('squid-web-prd')
    expect(rules?.propertyValue).toBeDefined()
    expect(JSON.parse(rules!.propertyValue)[0].host).toBe('squid-deploy.solarifyai.com')
  })
})

describe('useContainersEditorState — imported Kubernetes data', () => {
  it('accepts imported key/value properties stored as JSON object maps', () => {
    const step: DeploymentStepDto = {
      id: 10,
      processId: 1,
      stepOrder: 0,
      name: 'Configure and apply Kubernetes resources',
      stepType: 'Action',
      condition: 'Success',
      startTrigger: 'StartAfterPrevious',
      packageRequirement: 'LetSquidDecide',
      isDisabled: false,
      isRequired: false,
      createdAt: '2026-08-27T00:00:00Z',
      properties: [],
      actions: [
        {
          id: 20,
          stepId: 10,
          actionOrder: 0,
          name: 'Configure and apply Kubernetes resources',
          actionType: 'Squid.KubernetesDeployContainers',
          workerPoolId: null,
          isDisabled: false,
          isRequired: false,
          canBeUsedForProjectVersioning: false,
          createdAt: '2026-08-27T00:00:00Z',
          environments: [],
          excludedEnvironments: [],
          channels: [],
          properties: [
            {
              id: 30,
              actionId: 20,
              propertyName: 'Squid.Action.KubernetesContainers.DeploymentLabels',
              propertyValue: JSON.stringify({ app: 'squid', tier: 'web' }),
            },
          ],
        },
      ],
    }

    const { result } = renderHook(() => useContainersEditorState(step))

    expect(result.current.state.deploymentLabels).toEqual([
      { key: 'app', value: 'squid' },
      { key: 'tier', value: 'web' },
    ])
  })
})
