import { describe, it, expect } from 'vitest'
import { generateDeploymentYaml, generateServiceYaml, generateIngressYaml, generateConfigMapYaml, generateSecretYaml } from './generateYaml'
import { parseYamlToState } from './parseYamlToState'
import { defaultEditorState, defaultContainer } from './types'
import type { ContainersEditorState } from './types'

// The bug these tests pin: every resource section has an "Edit YAML" modal that
// generates YAML from form state and parses it back on Done. Unquoted scalars made
// that round-trip lossy — `namespace: #{NameSpace}` is a YAML comment, so the value
// parsed back as empty, the empty value overwrote form state, and saving deleted the
// property. The user's #{NameSpace} silently became `default` on the next load.

function stateWith(overrides: Partial<ContainersEditorState>): ContainersEditorState {
  return { ...defaultEditorState(), ...overrides }
}

const octostacheState = stateWith({
  namespace: '#{NameSpace}',
  deploymentName: 'web',
  serviceName: 'web-svc',
  servicePorts: [{ name: 'http', port: '80', targetPort: '8080', nodePort: '', protocol: 'TCP' }],
  ingressName: 'web-ing',
  ingressRules: [{ host: 'a.example.com', paths: [{ path: '/', pathType: 'Prefix', backend: { serviceName: 'web-svc', servicePort: '80' } }] }],
  configMapName: 'web-cm',
  configMapValues: [{ key: 'APP_ENV', value: 'prod' }],
  secretName: 'web-secret',
  secretValues: [{ key: 'TOKEN', value: 's3cret' }],
})

describe('Edit-YAML round-trip preserves Octostache expressions', () => {
  it('quotes #{NameSpace} in generated YAML instead of emitting a YAML comment', () => {
    for (const yaml of [
      generateDeploymentYaml(octostacheState),
      generateServiceYaml(octostacheState),
      generateIngressYaml(octostacheState),
      generateConfigMapYaml(octostacheState),
      generateSecretYaml(octostacheState),
    ]) {
      expect(yaml).toBeTruthy()
      expect(yaml!).toContain('namespace: "#{NameSpace}"')
      expect(yaml!).not.toMatch(/namespace: #\{/)
    }
  })

  it.each([
    ['Deployment', generateDeploymentYaml],
    ['Service', generateServiceYaml],
    ['Ingress', generateIngressYaml],
    ['ConfigMap', generateConfigMapYaml],
    ['Secret', generateSecretYaml],
  ] as const)('%s: generate → parse returns the original #{NameSpace}', (_kind, generate) => {
    const yaml = generate(octostacheState)

    expect(yaml).toBeTruthy()
    expect(parseYamlToState(yaml!).namespace).toBe('#{NameSpace}')
  })

  it('preserves Octostache in other scalar positions (image, replicas, probe values)', () => {
    const state = stateWith({
      namespace: 'prod',
      deploymentName: '#{AppName}',
      replicas: '#{Replicas}',
      containers: [{ ...defaultContainer(), Name: 'app', Image: '#{Registry}/web:#{Tag}' }],
    })

    const parsed = parseYamlToState(generateDeploymentYaml(state))

    expect(parsed.deploymentName).toBe('#{AppName}')
    expect(parsed.replicas).toBe('#{Replicas}')
    expect(parsed.containers?.[0]?.Image).toBe('#{Registry}/web:#{Tag}')
  })

  it('keeps plain numeric replicas unquoted so exported YAML stays Kubernetes-valid', () => {
    const yaml = generateDeploymentYaml(stateWith({ replicas: '3' }))

    expect(yaml).toContain('replicas: 3')
    expect(yaml).not.toContain('replicas: "3"')
  })

  it('escapes label/annotation and ConfigMap values containing quotes', () => {
    const state = stateWith({
      configMapName: 'cm',
      configMapValues: [{ key: 'MESSAGE', value: 'he said "hi" \\ bye' }],
    })

    const parsed = parseYamlToState(generateConfigMapYaml(state)!)

    expect(parsed.configMapValues).toEqual([{ key: 'MESSAGE', value: 'he said "hi" \\ bye' }])
  })
})

describe('absent fields never overwrite form state', () => {
  it('YAML without metadata.namespace omits the key entirely', () => {
    const partial = parseYamlToState(['apiVersion: v1', 'kind: ConfigMap', 'metadata:', '  name: cm', 'data:', '  A: "1"'].join('\n'))

    expect('namespace' in partial).toBe(false)
  })

  it.each(['Service', 'Ingress', 'Secret', 'Deployment'] as const)('%s without a namespace omits the key', (kind) => {
    const apiVersion = kind === 'Deployment' ? 'apps/v1' : kind === 'Ingress' ? 'networking.k8s.io/v1' : 'v1'
    const partial = parseYamlToState([`apiVersion: ${apiVersion}`, `kind: ${kind}`, 'metadata:', '  name: x'].join('\n'))

    expect('namespace' in partial).toBe(false)
  })

  it('a namespace explicitly present in pasted YAML still applies', () => {
    const partial = parseYamlToState(['apiVersion: v1', 'kind: ConfigMap', 'metadata:', '  name: cm', '  namespace: staging'].join('\n'))

    expect(partial.namespace).toBe('staging')
  })
})
