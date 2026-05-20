import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { AutoComplete, Button, Checkbox, Input, Modal, Radio, Select, message } from 'antd'
import { CloseOutlined, MoreOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  createDeploymentStep,
  getTargetRoles,
  updateDeploymentStep,
  type DeploymentActionDto,
  type DeploymentActionPropertyDto,
  type DeploymentStepDto,
  type DeploymentStepPropertyDto,
} from 'pages/apis/deploymentProcess'
import { getExternalFeeds, searchExternalFeedPackages, type ExternalFeedDto } from 'pages/apis/externalFeed'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import { StepConditionsSection, type StepConditionsValue, type StepEnvironmentMode } from '../shared/StepConditionsSection'
import { TargetTagSelect } from '../shared/TargetTagSelect'
import type { StepEditorHandle, StepEditorProps } from '../shared/StepEditorTypes'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string
const ACTION_TYPE = 'Squid.DeployToIISWebSite'
const DEFAULT_STEP_NAME = 'Deploy to IIS'
const STEP_CONDITION_EXPRESSION_PROPERTY = 'Squid.Step.ConditionExpression'
const TARGET_ROLE_PROPERTY_NAMES = ['Squid.Action.TargetRoles', 'TargetRoles'] as const

// ── Configure-Features modal (Octopus parity: Octopus.Action.EnabledFeatures CSV gate) ──
// Persisted as a comma-separated list under `Squid.Action.EnabledFeatures`. Each entry is the
// feature ID below; UI sections render only when their ID is present. Toggling a feature off
// hides its section AND drops the section's properties on save (matching Octopus's "Configure
// Features" behaviour where un-checking removes the entire surface — re-checking yields empty
// defaults). The 5 supported features map to live editor sections; the 2 unsupported ones are
// listed for migrate-from-Octopus operators with a "Coming soon" tag, no UI section yet.
const FEATURES_PROPERTY = 'Squid.Action.EnabledFeatures'

type IisFeatureId =
  | 'Squid.Features.CustomDirectory'
  | 'Squid.Features.CustomScripts'
  | 'Squid.Features.JsonConfigurationVariables'
  | 'Squid.Features.ConfigurationVariables'
  | 'Squid.Features.ConfigurationTransforms'
  | 'Squid.Features.SubstituteInFiles'
  | 'Squid.Features.PowerShellEdition'

interface IisFeatureDescriptor {
  id: IisFeatureId
  name: string
  description: React.ReactNode
  supported: boolean
}

const IIS_FEATURES: readonly IisFeatureDescriptor[] = [
  {
    id: 'Squid.Features.CustomDirectory',
    name: 'Custom Installation Directory',
    description: 'Change where Tentacle extracts your package',
    supported: false,
  },
  {
    id: 'Squid.Features.CustomScripts',
    name: 'Custom Deployment Scripts',
    description: 'Execute scripts during the deployment, without embedding them in your package',
    supported: true,
  },
  {
    id: 'Squid.Features.JsonConfigurationVariables',
    name: 'Structured Configuration Variables',
    description: 'Replace settings in JSON, YAML, XML, and Java Properties files with variables defined in Squid.',
    supported: true,
  },
  {
    id: 'Squid.Features.ConfigurationVariables',
    name: '.NET Configuration Variables',
    description: (<>Replace settings in any <em>.config</em> files with variables defined in Squid.</>),
    supported: true,
  },
  {
    id: 'Squid.Features.ConfigurationTransforms',
    name: '.NET Configuration Transforms',
    description: (<>Runs configuration file transforms, such as <em>Web.Release.config</em></>),
    supported: true,
  },
  {
    id: 'Squid.Features.SubstituteInFiles',
    name: 'Substitute Variables in Templates',
    description: (<>Transforms files using the Squid <code>#{'{Variable}'}</code> substitution syntax</>),
    supported: true,
  },
  {
    id: 'Squid.Features.PowerShellEdition',
    name: 'PowerShell Edition',
    description: 'Specify the edition of PowerShell used during deployments',
    supported: false,
  },
]

const PackageProperties = {
  feedId: ['Squid.Action.Package.FeedId', 'Octopus.Action.Package.FeedId'],
  packageId: ['Squid.Action.Package.PackageId', 'Octopus.Action.Package.PackageId'],
  version: ['Squid.Action.Package.PackageVersion', 'Octopus.Action.Package.PackageVersion'],
} as const

const IisProperties = {
  deploymentType: ['Squid.Action.IISWebSite.DeploymentType', 'Squid.Action.IIS.DeploymentType', 'Octopus.Action.IIS.DeploymentType'],
  createOrUpdateWebSite: ['Squid.Action.IISWebSite.CreateOrUpdateWebSite'],
  webApplicationCreateOrUpdate: ['Squid.Action.IISWebSite.WebApplication.CreateOrUpdate'],
  virtualDirectoryCreateOrUpdate: ['Squid.Action.IISWebSite.VirtualDirectory.CreateOrUpdate'],
  webSiteName: ['Squid.Action.IISWebSite.WebSiteName', 'Squid.Action.IIS.WebSiteName', 'Octopus.Action.IIS.WebSiteName'],
  webRoot: ['Squid.Action.IISWebSite.WebRoot'],
  webApplicationWebSiteName: ['Squid.Action.IISWebSite.WebApplication.WebSiteName'],
  webApplicationVirtualPath: ['Squid.Action.IISWebSite.WebApplication.VirtualPath'],
  webApplicationPhysicalPath: ['Squid.Action.IISWebSite.WebApplication.PhysicalPath'],
  virtualDirectoryWebSiteName: ['Squid.Action.IISWebSite.VirtualDirectory.WebSiteName'],
  virtualDirectoryVirtualPath: ['Squid.Action.IISWebSite.VirtualDirectory.VirtualPath'],
  virtualDirectoryPhysicalPath: ['Squid.Action.IISWebSite.VirtualDirectory.PhysicalPath'],
  virtualDirectoryName: ['Squid.Action.IIS.VirtualDirectoryName', 'Octopus.Action.IIS.VirtualDirectoryName'],
  webApplicationName: ['Squid.Action.IIS.WebApplicationName', 'Octopus.Action.IIS.WebApplicationName'],
  physicalPathMode: ['Squid.Action.IIS.PhysicalPathMode', 'Octopus.Action.IIS.PhysicalPathMode'],
  relativePath: ['Squid.Action.IIS.RelativePath', 'Octopus.Action.IIS.RelativePath'],
  startWebSite: ['Squid.Action.IISWebSite.StartWebSite', 'Squid.Action.IIS.StartWebSite', 'Octopus.Action.IIS.StartWebSite'],
  applicationPoolName: ['Squid.Action.IISWebSite.ApplicationPoolName', 'Squid.Action.IIS.ApplicationPoolName', 'Octopus.Action.IIS.ApplicationPoolName'],
  webApplicationApplicationPoolName: ['Squid.Action.IISWebSite.WebApplication.ApplicationPoolName'],
  applicationPoolClr: ['Squid.Action.IISWebSite.ApplicationPoolFrameworkVersion', 'Squid.Action.IIS.ApplicationPoolClrVersion', 'Octopus.Action.IIS.ApplicationPoolClrVersion'],
  webApplicationApplicationPoolClr: ['Squid.Action.IISWebSite.WebApplication.ApplicationPoolFrameworkVersion'],
  applicationPoolIdentity: ['Squid.Action.IISWebSite.ApplicationPoolIdentityType', 'Squid.Action.IIS.ApplicationPoolIdentity', 'Octopus.Action.IIS.ApplicationPoolIdentity'],
  webApplicationApplicationPoolIdentity: ['Squid.Action.IISWebSite.WebApplication.ApplicationPoolIdentityType'],
  applicationPoolUsername: ['Squid.Action.IISWebSite.ApplicationPoolUsername', 'Squid.Action.IIS.ApplicationPoolUsername', 'Octopus.Action.IIS.ApplicationPoolUsername'],
  applicationPoolPassword: ['Squid.Action.IISWebSite.ApplicationPoolPassword', 'Squid.Action.IIS.ApplicationPoolPassword', 'Octopus.Action.IIS.ApplicationPoolPassword'],
  webApplicationApplicationPoolUsername: ['Squid.Action.IISWebSite.WebApplication.ApplicationPoolUsername'],
  webApplicationApplicationPoolPassword: ['Squid.Action.IISWebSite.WebApplication.ApplicationPoolPassword'],
  startApplicationPool: ['Squid.Action.IISWebSite.StartApplicationPool', 'Squid.Action.IIS.StartApplicationPool', 'Octopus.Action.IIS.StartApplicationPool'],
  bindings: ['Squid.Action.IISWebSite.Bindings', 'Squid.Action.IIS.Bindings', 'Octopus.Action.IIS.Bindings'],
  existingBindings: ['Squid.Action.IISWebSite.ExistingBindings', 'Squid.Action.IIS.ExistingBindings', 'Octopus.Action.IIS.ExistingBindings'],
  authAnonymous: ['Squid.Action.IISWebSite.EnableAnonymousAuthentication', 'Squid.Action.IIS.Auth.Anonymous', 'Octopus.Action.IIS.Auth.Anonymous'],
  authBasic: ['Squid.Action.IISWebSite.EnableBasicAuthentication', 'Squid.Action.IIS.Auth.Basic', 'Octopus.Action.IIS.Auth.Basic'],
  authWindows: ['Squid.Action.IISWebSite.EnableWindowsAuthentication', 'Squid.Action.IIS.Auth.Windows', 'Octopus.Action.IIS.Auth.Windows'],
  replaceConfigVariables: ['Squid.Action.IISWebSite.ConfigurationVariables.Enabled', 'Squid.Action.IIS.ReplaceConfigVariables', 'Octopus.Action.IIS.ReplaceConfigVariables'],
  runConfigTransforms: ['Squid.Action.IISWebSite.ConfigurationTransforms.Enabled', 'Squid.Action.IIS.RunConfigTransforms', 'Octopus.Action.IIS.RunConfigTransforms'],
  configTransformsEnvironmentName: ['Squid.Action.IISWebSite.ConfigurationTransforms.EnvironmentName'],
  additionalTransforms: ['Squid.Action.IISWebSite.ConfigurationTransforms.AdditionalTransforms', 'Squid.Action.IIS.AdditionalTransforms', 'Octopus.Action.IIS.AdditionalTransforms'],
  // SubstituteInFiles (Phase 8)
  substituteInFilesEnabled: ['Squid.Action.IISWebSite.SubstituteInFiles.Enabled'],
  substituteInFilesTargetFiles: ['Squid.Action.IISWebSite.SubstituteInFiles.TargetFiles'],
  // StructuredConfigurationVariables (Phase 9 — JSON leaf replacement)
  structuredConfigEnabled: ['Squid.Action.IISWebSite.StructuredConfigurationVariables.Enabled'],
  structuredConfigTargets: ['Squid.Action.IISWebSite.StructuredConfigurationVariables.Targets'],
  // Additional config-rewriter scan paths
  additionalPaths: ['Squid.Action.IISWebSite.AdditionalPaths'],
  // Custom scripts (PreDeploy / PostDeploy)
  customScriptsPreDeploy: ['Squid.Action.CustomScripts.PreDeploy.ps1'],
  customScriptsPostDeploy: ['Squid.Action.CustomScripts.PostDeploy.ps1'],
  // HTTPS Certificate auto-import (P0-1)
  certificatePfxBase64: ['Squid.Action.IISWebSite.Certificate.PfxBase64'],
  certificatePfxPassword: ['Squid.Action.IISWebSite.Certificate.PfxPassword'],
  certificateThumbprintVariableName: ['Squid.Action.IISWebSite.Certificate.ThumbprintVariableName'],
  // Package extraction (Phase 10) + deployment journal short-circuit (P0-2)
  packageSourcePath: ['Squid.Action.IISWebSite.Package.SourcePath'],
  packageExtractTo: ['Squid.Action.IISWebSite.Package.ExtractTo'],
  packagePurgeBeforeExtract: ['Squid.Action.IISWebSite.Package.PurgeBeforeExtract'],
  packageSkipIfAlreadyInstalled: ['Squid.Action.IISWebSite.Package.SkipIfAlreadyInstalled'],
  // IIS metabase retry tuning
  maxRetryFailures: ['Squid.Action.IISWebSite.MaxRetryFailures'],
  sleepBetweenRetryFailuresInSeconds: ['Squid.Action.IISWebSite.SleepBetweenRetryFailuresInSeconds'],
  // Error tolerance + diagnostics (P2-1, cross-action namespace — NOT under IISWebSite)
  ignoreVariableReplacementErrors: ['Squid.Action.Package.IgnoreVariableReplacementErrors'],
  shouldFailDeploymentOnSubstitutionFails: ['Squid.Action.SubstituteInFiles.ShouldFailDeploymentOnSubstitutionFails'],
  enableDiagnosticsConfigTransformationLogging: ['Squid.Action.Package.EnableDiagnosticsConfigTransformationLogging'],
} as const

const ActionPropertyFilterSet = new Set<string>([
  ...Object.values(PackageProperties).flat(),
  ...Object.values(IisProperties).flat(),
  FEATURES_PROPERTY,
])
const StepPropertyFilterSet = new Set<string>([STEP_CONDITION_EXPRESSION_PROPERTY, ...TARGET_ROLE_PROPERTY_NAMES])

type IisDeploymentType = 'webSite' | 'virtualDirectory' | 'webApplication'
type PhysicalPathMode = 'packageRoot' | 'relativeToPackageRoot'
type ExistingBindingsMode = 'Replace' | 'Merge'
type StartTriggerMode = 'StartAfterPrevious' | 'StartWithPrevious'
type AppPoolClrVersion = 'v2.0' | 'v4.0' | 'No Managed Code'
type AppPoolIdentity = 'ApplicationPoolIdentity' | 'NetworkService' | 'LocalService' | 'LocalSystem' | 'SpecificUser'
type BindingProtocol = 'http' | 'https' | 'net.tcp' | 'net.pipe' | 'net.msmq' | 'msmq.formatname'

const BINDING_PROTOCOL_VALUES: readonly BindingProtocol[] = ['http', 'https', 'net.tcp', 'net.pipe', 'net.msmq', 'msmq.formatname']

interface IisBinding {
  id: string
  protocol: BindingProtocol
  port: string
  ipAddress: string
  hostName: string
  enabled: boolean
  requireSni: boolean
  thumbprint: string
  certificateVariable: string
}

interface IisActionValues {
  packageFeedId: string
  packageId: string
  packageVersion: string
  deploymentType: IisDeploymentType
  webSiteName: string
  virtualDirectoryName: string
  webApplicationName: string
  physicalPathMode: PhysicalPathMode
  relativePath: string
  startWebSite: boolean
  appPoolName: string
  appPoolClrVersion: AppPoolClrVersion
  appPoolIdentity: AppPoolIdentity
  appPoolUsername: string
  appPoolPassword: string
  startAppPool: boolean
  bindings: IisBinding[]
  existingBindings: ExistingBindingsMode
  authAnonymous: boolean
  authBasic: boolean
  authWindows: boolean
  replaceConfigVariables: boolean
  runConfigTransforms: boolean
  configTransformsEnvironmentName: string
  additionalTransforms: string
  substituteInFilesEnabled: boolean
  substituteInFilesTargetFiles: string
  structuredConfigEnabled: boolean
  structuredConfigTargets: string
  additionalPaths: string
  customScriptsPreDeploy: string
  customScriptsPostDeploy: string
  certificatePfxBase64: string
  certificatePfxPassword: string
  certificateThumbprintVariableName: string
  packageSourcePath: string
  packageExtractTo: string
  packagePurgeBeforeExtract: boolean
  packageSkipIfAlreadyInstalled: boolean
  maxRetryFailures: string
  sleepBetweenRetryFailuresInSeconds: string
  ignoreVariableReplacementErrors: boolean
  shouldFailDeploymentOnSubstitutionFails: boolean
  enableDiagnosticsConfigTransformationLogging: boolean
  enabledFeatures: ReadonlySet<IisFeatureId>
}

function getActionProperty(action: DeploymentActionDto | undefined, names: readonly string[]): string | undefined {
  if (!action) return undefined
  for (const name of names) {
    const value = action.properties.find((property) => property.propertyName === name)?.propertyValue
    if (value != null) return value
  }
  return undefined
}

function getStepProperty(stepProperties: DeploymentStepPropertyDto[] | undefined, name: string): string {
  if (!stepProperties) return ''
  return stepProperties.find((property) => property.propertyName === name)?.propertyValue ?? ''
}

function normalizeBoolean(value: string | undefined, fallback = false): boolean {
  if (!value?.trim()) return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false
  return fallback
}

function normalizeDeploymentType(value: string | undefined): IisDeploymentType {
  if (value === 'virtualDirectory' || value === 'VirtualDirectory') return 'virtualDirectory'
  if (value === 'webApplication' || value === 'WebApplication') return 'webApplication'
  return 'webSite'
}

function normalizeDeploymentTypeFromAction(action: DeploymentActionDto | undefined): IisDeploymentType {
  const explicitType = getActionProperty(action, IisProperties.deploymentType)
  if (explicitType) return normalizeDeploymentType(explicitType)
  if (normalizeBoolean(getActionProperty(action, IisProperties.virtualDirectoryCreateOrUpdate), false)) return 'virtualDirectory'
  if (normalizeBoolean(getActionProperty(action, IisProperties.webApplicationCreateOrUpdate), false)) return 'webApplication'
  return 'webSite'
}

function normalizePhysicalPathMode(value: string | undefined): PhysicalPathMode {
  return value === 'relativeToPackageRoot' ? 'relativeToPackageRoot' : 'packageRoot'
}

function normalizeExistingBindings(value: string | undefined): ExistingBindingsMode {
  return value === 'Merge' ? 'Merge' : 'Replace'
}

function normalizeClrVersion(value: string | undefined): AppPoolClrVersion {
  if (value === 'v2.0') return 'v2.0'
  if (value === 'No Managed Code' || value === '') return 'No Managed Code'
  return 'v4.0'
}

function normalizeIdentity(value: string | undefined): AppPoolIdentity {
  if (value === 'NetworkService') return 'NetworkService'
  if (value === 'LocalService') return 'LocalService'
  if (value === 'LocalSystem') return 'LocalSystem'
  if (value === 'SpecificUser') return 'SpecificUser'
  return 'ApplicationPoolIdentity'
}

function normalizeBindingProtocol(value: string | undefined): BindingProtocol {
  if (!value) return 'http'
  const lower = value.toLowerCase()
  return (BINDING_PROTOCOL_VALUES as readonly string[]).includes(lower) ? (lower as BindingProtocol) : 'http'
}

function normalizeNonNegativeIntegerString(value: string | undefined): string {
  if (!value?.trim()) return ''
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) return trimmed
  return ''
}

/**
 * Reconstruct the EnabledFeatures set for an existing action.
 *
 * Truth source: the action's `Squid.Action.EnabledFeatures` CSV property (set by prior FE
 * saves once this Configure-Features modal was deployed).
 *
 * Fallback (property absent — new step OR legacy step from before the modal landed): default
 * to the two Octopus-style baseline features (.NET Configuration Variables + Transforms).
 * The other 3 supported features (Substitute in Files / Structured Config / Custom Scripts)
 * stay opt-in via the Configure Features modal.
 */
const DEFAULT_ENABLED_FEATURES: readonly IisFeatureId[] = [
  'Squid.Features.ConfigurationVariables',
  'Squid.Features.ConfigurationTransforms',
]

function inferEnabledFeatures(action: DeploymentActionDto | undefined): Set<IisFeatureId> {
  const raw = getActionProperty(action, [FEATURES_PROPERTY])
  if (raw != null) {
    const tokens = raw.split(',').map((token) => token.trim()).filter(Boolean)
    const allowed = new Set<string>(IIS_FEATURES.filter((feature) => feature.supported).map((feature) => feature.id))
    return new Set(tokens.filter((token): token is IisFeatureId => allowed.has(token)))
  }

  return new Set(DEFAULT_ENABLED_FEATURES)
}

function serializeEnabledFeatures(features: ReadonlySet<IisFeatureId>): string {
  // Sorted CSV — keeps the saved property stable across no-op reopens.
  return Array.from(features).sort().join(',')
}

function getInitialWebSiteName(action: DeploymentActionDto | undefined, deploymentType: IisDeploymentType): string {
  if (deploymentType === 'virtualDirectory') {
    return getActionProperty(action, IisProperties.virtualDirectoryWebSiteName) ?? getActionProperty(action, IisProperties.webSiteName) ?? ''
  }
  if (deploymentType === 'webApplication') {
    return getActionProperty(action, IisProperties.webApplicationWebSiteName) ?? getActionProperty(action, IisProperties.webSiteName) ?? ''
  }
  return getActionProperty(action, IisProperties.webSiteName) ?? ''
}

function getInitialPhysicalPath(action: DeploymentActionDto | undefined, deploymentType: IisDeploymentType): string {
  if (deploymentType === 'virtualDirectory') {
    return getActionProperty(action, IisProperties.virtualDirectoryPhysicalPath) ?? getActionProperty(action, IisProperties.relativePath) ?? ''
  }
  if (deploymentType === 'webApplication') {
    return getActionProperty(action, IisProperties.webApplicationPhysicalPath) ?? getActionProperty(action, IisProperties.relativePath) ?? ''
  }
  return getActionProperty(action, IisProperties.webRoot) ?? getActionProperty(action, IisProperties.relativePath) ?? ''
}

function getInitialPhysicalPathMode(action: DeploymentActionDto | undefined, physicalPath: string): PhysicalPathMode {
  const legacyMode = getActionProperty(action, IisProperties.physicalPathMode)
  if (legacyMode) return normalizePhysicalPathMode(legacyMode)
  return physicalPath.trim() && physicalPath.trim() !== '.' ? 'relativeToPackageRoot' : 'packageRoot'
}

function getInitialApplicationPoolName(action: DeploymentActionDto | undefined, deploymentType: IisDeploymentType): string {
  if (deploymentType === 'webApplication') {
    return getActionProperty(action, IisProperties.webApplicationApplicationPoolName) ?? getActionProperty(action, IisProperties.applicationPoolName) ?? ''
  }
  return getActionProperty(action, IisProperties.applicationPoolName) ?? ''
}

function getInitialApplicationPoolClr(action: DeploymentActionDto | undefined, deploymentType: IisDeploymentType): AppPoolClrVersion {
  if (deploymentType === 'webApplication') {
    return normalizeClrVersion(getActionProperty(action, IisProperties.webApplicationApplicationPoolClr) ?? getActionProperty(action, IisProperties.applicationPoolClr))
  }
  return normalizeClrVersion(getActionProperty(action, IisProperties.applicationPoolClr))
}

function getInitialApplicationPoolIdentity(action: DeploymentActionDto | undefined, deploymentType: IisDeploymentType): AppPoolIdentity {
  if (deploymentType === 'webApplication') {
    return normalizeIdentity(getActionProperty(action, IisProperties.webApplicationApplicationPoolIdentity) ?? getActionProperty(action, IisProperties.applicationPoolIdentity))
  }
  return normalizeIdentity(getActionProperty(action, IisProperties.applicationPoolIdentity))
}

function getInitialApplicationPoolUsername(action: DeploymentActionDto | undefined, deploymentType: IisDeploymentType): string {
  if (deploymentType === 'webApplication') {
    return getActionProperty(action, IisProperties.webApplicationApplicationPoolUsername) ?? getActionProperty(action, IisProperties.applicationPoolUsername) ?? ''
  }
  return getActionProperty(action, IisProperties.applicationPoolUsername) ?? ''
}

function getInitialApplicationPoolPassword(action: DeploymentActionDto | undefined, deploymentType: IisDeploymentType): string {
  if (deploymentType === 'webApplication') {
    return getActionProperty(action, IisProperties.webApplicationApplicationPoolPassword) ?? getActionProperty(action, IisProperties.applicationPoolPassword) ?? ''
  }
  return getActionProperty(action, IisProperties.applicationPoolPassword) ?? ''
}

function resolvePhysicalPathValue(values: IisActionValues): string {
  return values.physicalPathMode === 'relativeToPackageRoot' ? values.relativePath.trim() : '.'
}

function createDefaultBinding(): IisBinding {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    protocol: 'http',
    port: '80',
    ipAddress: '',
    hostName: '',
    enabled: true,
    requireSni: false,
    thumbprint: '',
    certificateVariable: '',
  }
}

function readBooleanLikeField(source: Record<string, unknown>, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const raw = source[key]
    if (raw === undefined || raw === null) continue
    if (typeof raw === 'boolean') return raw
    if (typeof raw === 'string' || typeof raw === 'number') {
      const text = String(raw).trim()
      if (!text) continue
      const lower = text.toLowerCase()
      if (lower === 'true' || lower === '1' || lower === 'yes') return true
      if (lower === 'false' || lower === '0' || lower === 'no') return false
    }
  }
  return undefined
}

function parseBindings(value: string | undefined): IisBinding[] {
  if (!value?.trim()) return [createDefaultBinding()]

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return [createDefaultBinding()]
    const next = parsed
      .map((entry): IisBinding | null => {
        if (!entry || typeof entry !== 'object') return null
        const source = entry as Record<string, unknown>
        const normalizedProtocol = normalizeBindingProtocol(String(source.protocol ?? source.Protocol ?? 'http'))
        const portValue = String(source.port ?? source.Port ?? (normalizedProtocol === 'https' ? '443' : '80'))
        const hostName = String(source.hostName ?? source.hostname ?? source.HostName ?? source.Hostname ?? source.host ?? '')
        const ipAddress = String(source.ipAddress ?? source.IPAddress ?? source.ip ?? '')
        const enabled = readBooleanLikeField(source, 'enabled', 'Enabled') ?? true
        const requireSni = readBooleanLikeField(source, 'requireSni', 'RequireSni', 'SniRequired', 'sniRequired') ?? false
        const thumbprint = String(source.thumbprint ?? source.Thumbprint ?? '')
        const certificateVariable = String(source.certificateVariable ?? source.CertificateVariable ?? '')
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          protocol: normalizedProtocol,
          port: portValue,
          ipAddress,
          hostName,
          enabled,
          requireSni,
          thumbprint,
          certificateVariable,
        }
      })
      .filter((item): item is IisBinding => Boolean(item))
    return next.length > 0 ? next : [createDefaultBinding()]
  } catch {
    return [createDefaultBinding()]
  }
}

function serializeBindings(bindings: IisBinding[]): string {
  const normalized = bindings.map((binding) => {
    const base: Record<string, unknown> = {
      protocol: binding.protocol,
      port: binding.port.trim(),
      host: binding.hostName.trim(),
      ipAddress: binding.ipAddress.trim() || '*',
      enabled: binding.enabled,
      requireSni: binding.requireSni,
    }

    if (binding.protocol === 'https') {
      const cv = binding.certificateVariable.trim()
      const tb = binding.thumbprint.trim()
      // Prefer certificateVariable — PS line 486-490 picks it first; thumbprint is the fallback.
      if (cv) base.certificateVariable = cv
      else if (tb) base.thumbprint = tb
    }

    return base
  })
  return JSON.stringify(normalized)
}

function boolPropertyValue(value: boolean): string {
  return value ? 'True' : 'False'
}

function buildActionProperties(existingAction: DeploymentActionDto | undefined, values: IisActionValues): DeploymentActionPropertyDto[] {
  const preserved = (existingAction?.properties ?? []).filter(
    (property) => !ActionPropertyFilterSet.has(property.propertyName) && !property.propertyName.startsWith('Octopus.'),
  )
  const next: DeploymentActionPropertyDto[] = [...preserved]

  const pushProperty = (name: string, value: string, allowEmpty = false) => {
    if (!allowEmpty && value.trim() === '') return
    next.push({
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: name,
      propertyValue: value,
    })
  }

  pushProperty(PackageProperties.feedId[0], values.packageFeedId)
  pushProperty(PackageProperties.packageId[0], values.packageId)
  pushProperty(PackageProperties.version[0], values.packageVersion)
  const physicalPath = resolvePhysicalPathValue(values)
  const deployWebSite = values.deploymentType === 'webSite'
  const deployWebApplication = values.deploymentType === 'webApplication'
  const deployVirtualDirectory = values.deploymentType === 'virtualDirectory'

  pushProperty(IisProperties.deploymentType[0], values.deploymentType)
  pushProperty(IisProperties.createOrUpdateWebSite[0], boolPropertyValue(deployWebSite))
  pushProperty(IisProperties.webApplicationCreateOrUpdate[0], boolPropertyValue(deployWebApplication))
  pushProperty(IisProperties.virtualDirectoryCreateOrUpdate[0], boolPropertyValue(deployVirtualDirectory))

  const useSpecificUser = values.appPoolIdentity === 'SpecificUser'

  if (deployWebSite) {
    pushProperty(IisProperties.webSiteName[0], values.webSiteName)
    pushProperty(IisProperties.webRoot[0], physicalPath)
    pushProperty(IisProperties.applicationPoolName[0], values.appPoolName)
    pushProperty(IisProperties.applicationPoolClr[0], values.appPoolClrVersion)
    pushProperty(IisProperties.applicationPoolIdentity[0], values.appPoolIdentity)
    if (useSpecificUser) {
      pushProperty(IisProperties.applicationPoolUsername[0], values.appPoolUsername)
      pushProperty(IisProperties.applicationPoolPassword[0], values.appPoolPassword, true)
    }
    pushProperty(IisProperties.startApplicationPool[0], boolPropertyValue(values.startAppPool))
    pushProperty(IisProperties.bindings[0], serializeBindings(values.bindings))
    pushProperty(IisProperties.existingBindings[0], values.existingBindings)
    pushProperty(IisProperties.authAnonymous[0], boolPropertyValue(values.authAnonymous))
    pushProperty(IisProperties.authBasic[0], boolPropertyValue(values.authBasic))
    pushProperty(IisProperties.authWindows[0], boolPropertyValue(values.authWindows))
    pushProperty(IisProperties.startWebSite[0], boolPropertyValue(values.startWebSite))
  }

  if (deployWebApplication) {
    pushProperty(IisProperties.webApplicationWebSiteName[0], values.webSiteName)
    pushProperty(IisProperties.webApplicationVirtualPath[0], values.webApplicationName)
    pushProperty(IisProperties.webApplicationPhysicalPath[0], physicalPath)
    pushProperty(IisProperties.webApplicationApplicationPoolName[0], values.appPoolName)
    pushProperty(IisProperties.webApplicationApplicationPoolClr[0], values.appPoolClrVersion)
    pushProperty(IisProperties.webApplicationApplicationPoolIdentity[0], values.appPoolIdentity)
    if (useSpecificUser) {
      pushProperty(IisProperties.webApplicationApplicationPoolUsername[0], values.appPoolUsername)
      pushProperty(IisProperties.webApplicationApplicationPoolPassword[0], values.appPoolPassword, true)
    }
    pushProperty(IisProperties.startApplicationPool[0], boolPropertyValue(values.startAppPool))
  }

  if (deployVirtualDirectory) {
    pushProperty(IisProperties.virtualDirectoryWebSiteName[0], values.webSiteName)
    pushProperty(IisProperties.virtualDirectoryVirtualPath[0], values.virtualDirectoryName)
    pushProperty(IisProperties.virtualDirectoryPhysicalPath[0], physicalPath)
  }

  // .NET Configuration Variables — gated by Squid.Features.ConfigurationVariables.
  if (values.enabledFeatures.has('Squid.Features.ConfigurationVariables')) {
    pushProperty(IisProperties.replaceConfigVariables[0], boolPropertyValue(values.replaceConfigVariables))
  }

  // .NET Configuration Transforms — gated by Squid.Features.ConfigurationTransforms.
  if (values.enabledFeatures.has('Squid.Features.ConfigurationTransforms')) {
    pushProperty(IisProperties.runConfigTransforms[0], boolPropertyValue(values.runConfigTransforms))
    if (values.runConfigTransforms) {
      pushProperty(IisProperties.configTransformsEnvironmentName[0], values.configTransformsEnvironmentName, true)
    }
    pushProperty(IisProperties.additionalTransforms[0], values.additionalTransforms, true)
  }

  // Substitute Variables in Files — gated by Squid.Features.SubstituteInFiles.
  if (values.enabledFeatures.has('Squid.Features.SubstituteInFiles')) {
    pushProperty(IisProperties.substituteInFilesEnabled[0], boolPropertyValue(values.substituteInFilesEnabled))
    if (values.substituteInFilesEnabled) {
      pushProperty(IisProperties.substituteInFilesTargetFiles[0], values.substituteInFilesTargetFiles, true)
    }
  }

  // Structured Configuration Variables — gated by Squid.Features.JsonConfigurationVariables (Octopus alias).
  if (values.enabledFeatures.has('Squid.Features.JsonConfigurationVariables')) {
    pushProperty(IisProperties.structuredConfigEnabled[0], boolPropertyValue(values.structuredConfigEnabled))
    if (values.structuredConfigEnabled) {
      pushProperty(IisProperties.structuredConfigTargets[0], values.structuredConfigTargets, true)
    }
  }

  // AdditionalPaths — shared by all 4 rewriters; only relevant if any rewriter feature is on,
  // but we let operators pre-populate so it stays even if no rewriter is currently enabled.
  pushProperty(IisProperties.additionalPaths[0], values.additionalPaths, true)

  // Custom Deployment Scripts — gated by Squid.Features.CustomScripts.
  if (values.enabledFeatures.has('Squid.Features.CustomScripts')) {
    pushProperty(IisProperties.customScriptsPreDeploy[0], values.customScriptsPreDeploy, true)
    pushProperty(IisProperties.customScriptsPostDeploy[0], values.customScriptsPostDeploy, true)
  }

  // Configure-Features modal selection — persist the CSV so the next reopen sees the same gate.
  pushProperty(FEATURES_PROPERTY, serializeEnabledFeatures(values.enabledFeatures), true)

  // HTTPS certificate auto-import
  pushProperty(IisProperties.certificatePfxBase64[0], values.certificatePfxBase64)
  pushProperty(IisProperties.certificatePfxPassword[0], values.certificatePfxPassword, true)
  pushProperty(IisProperties.certificateThumbprintVariableName[0], values.certificateThumbprintVariableName)

  // Package extraction + journal short-circuit
  pushProperty(IisProperties.packageSourcePath[0], values.packageSourcePath)
  pushProperty(IisProperties.packageExtractTo[0], values.packageExtractTo)
  pushProperty(IisProperties.packagePurgeBeforeExtract[0], boolPropertyValue(values.packagePurgeBeforeExtract))
  pushProperty(IisProperties.packageSkipIfAlreadyInstalled[0], boolPropertyValue(values.packageSkipIfAlreadyInstalled))

  // IIS metabase retry tuning
  pushProperty(IisProperties.maxRetryFailures[0], values.maxRetryFailures)
  pushProperty(IisProperties.sleepBetweenRetryFailuresInSeconds[0], values.sleepBetweenRetryFailuresInSeconds)

  // Error tolerance + diagnostics
  pushProperty(IisProperties.ignoreVariableReplacementErrors[0], boolPropertyValue(values.ignoreVariableReplacementErrors))
  pushProperty(IisProperties.shouldFailDeploymentOnSubstitutionFails[0], boolPropertyValue(values.shouldFailDeploymentOnSubstitutionFails))
  pushProperty(IisProperties.enableDiagnosticsConfigTransformationLogging[0], boolPropertyValue(values.enableDiagnosticsConfigTransformationLogging))

  return next
}

function buildStepProperties(
  existingStepProperties: DeploymentStepPropertyDto[] | undefined,
  stepId: number,
  conditions: StepConditionsValue,
  targetTags: string[],
): DeploymentStepPropertyDto[] {
  const preserved = (existingStepProperties ?? []).filter(
    (property) => !StepPropertyFilterSet.has(property.propertyName),
  )
  const next: DeploymentStepPropertyDto[] = [...preserved]

  if (conditions.runCondition === 'Variable' && conditions.conditionExpression.trim()) {
    next.push({
      id: 0,
      stepId,
      propertyName: STEP_CONDITION_EXPRESSION_PROPERTY,
      propertyValue: conditions.conditionExpression.trim(),
    })
  }

  if (targetTags.length > 0) {
    next.push({
      id: 0,
      stepId,
      propertyName: TARGET_ROLE_PROPERTY_NAMES[0],
      propertyValue: targetTags.join(','),
    })
  }

  return next
}

export const DeployToIisEditor = forwardRef<StepEditorHandle, StepEditorProps>(
  function DeployToIisEditor({ step, processId, projectId, spaceId, stepIndex, onSave, onStepNameChange }, ref) {
    const action = step?.actions[0]
    const includeEnvironments = action?.environments ?? []
    const excludeEnvironments = action?.excludedEnvironments ?? []
    const initialEnvironmentMode: StepEnvironmentMode = excludeEnvironments.length > 0
      ? 'exclude'
      : includeEnvironments.length > 0
        ? 'include'
        : 'all'

    const [stepName, setStepName] = useState(step?.name ?? DEFAULT_STEP_NAME)
    const [targetTags, setTargetTags] = useState<string[]>(() => step ? getTargetRoles(step) : [])
    const [startTrigger, setStartTrigger] = useState<StartTriggerMode>(
      step?.startTrigger === 'StartWithPrevious' ? 'StartWithPrevious' : 'StartAfterPrevious',
    )
    const [conditions, setConditions] = useState<StepConditionsValue>({
      environmentMode: initialEnvironmentMode,
      environmentIds: initialEnvironmentMode === 'exclude' ? excludeEnvironments : includeEnvironments,
      channelIds: action?.channels ?? [],
      runCondition: step?.condition ?? 'Success',
      conditionExpression: getStepProperty(step?.properties, STEP_CONDITION_EXPRESSION_PROPERTY),
      packageRequirement: step?.packageRequirement ?? 'LetSquidDecide',
      required: step?.isRequired ?? false,
      disabled: step?.isDisabled ?? false,
    })

    const [packageFeedId, setPackageFeedId] = useState(getActionProperty(action, PackageProperties.feedId) ?? '')
    const [packageId, setPackageId] = useState(getActionProperty(action, PackageProperties.packageId) ?? '')
    const [packageVersion, setPackageVersion] = useState(getActionProperty(action, PackageProperties.version) ?? '')
    const [feedsLoading, setFeedsLoading] = useState(false)
    const [feeds, setFeeds] = useState<ExternalFeedDto[]>([])
    const [feedOptions, setFeedOptions] = useState<{ label: string; value: string }[]>([])
    const [packageSearchTerm, setPackageSearchTerm] = useState(packageId)
    const [packageSearchOptions, setPackageSearchOptions] = useState<string[]>([])
    const [packageSearchLoading, setPackageSearchLoading] = useState(false)
    const packageSearchRequestId = useRef(0)

    const initialDeploymentType = useMemo(() => normalizeDeploymentTypeFromAction(action), [action])
    const initialPhysicalPath = useMemo(() => getInitialPhysicalPath(action, initialDeploymentType), [action, initialDeploymentType])
    const [deploymentType, setDeploymentType] = useState<IisDeploymentType>(initialDeploymentType)
    const [webSiteName, setWebSiteName] = useState(getInitialWebSiteName(action, initialDeploymentType))
    const [virtualDirectoryName, setVirtualDirectoryName] = useState(
      getActionProperty(action, IisProperties.virtualDirectoryVirtualPath) ?? getActionProperty(action, IisProperties.virtualDirectoryName) ?? '',
    )
    const [webApplicationName, setWebApplicationName] = useState(
      getActionProperty(action, IisProperties.webApplicationVirtualPath) ?? getActionProperty(action, IisProperties.webApplicationName) ?? '',
    )
    const [physicalPathMode, setPhysicalPathMode] = useState<PhysicalPathMode>(
      getInitialPhysicalPathMode(action, initialPhysicalPath),
    )
    const [relativePath, setRelativePath] = useState(initialPhysicalPath === '.' ? '' : initialPhysicalPath)
    const [startWebSite, setStartWebSite] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.startWebSite), true),
    )
    const [appPoolName, setAppPoolName] = useState(getInitialApplicationPoolName(action, initialDeploymentType))
    const [appPoolClrVersion, setAppPoolClrVersion] = useState<AppPoolClrVersion>(
      getInitialApplicationPoolClr(action, initialDeploymentType),
    )
    const [appPoolIdentity, setAppPoolIdentity] = useState<AppPoolIdentity>(
      getInitialApplicationPoolIdentity(action, initialDeploymentType),
    )
    const [appPoolUsername, setAppPoolUsername] = useState(
      getInitialApplicationPoolUsername(action, initialDeploymentType),
    )
    const [appPoolPassword, setAppPoolPassword] = useState(
      getInitialApplicationPoolPassword(action, initialDeploymentType),
    )
    const [startAppPool, setStartAppPool] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.startApplicationPool), true),
    )
    const [bindings, setBindings] = useState<IisBinding[]>(
      parseBindings(getActionProperty(action, IisProperties.bindings)),
    )
    const [bindingModalOpen, setBindingModalOpen] = useState(false)
    const [editingBindingId, setEditingBindingId] = useState<string | null>(null)
    const [bindingDraft, setBindingDraft] = useState<IisBinding>(() => createDefaultBinding())
    const [existingBindings, setExistingBindings] = useState<ExistingBindingsMode>(
      normalizeExistingBindings(getActionProperty(action, IisProperties.existingBindings)),
    )
    const [authAnonymous, setAuthAnonymous] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.authAnonymous), false),
    )
    const [authBasic, setAuthBasic] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.authBasic), false),
    )
    const [authWindows, setAuthWindows] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.authWindows), true),
    )
    const [replaceConfigVariables, setReplaceConfigVariables] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.replaceConfigVariables), true),
    )
    const [runConfigTransforms, setRunConfigTransforms] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.runConfigTransforms), true),
    )
    const [configTransformsEnvironmentName, setConfigTransformsEnvironmentName] = useState(
      getActionProperty(action, IisProperties.configTransformsEnvironmentName) ?? '#{Squid.Environment.Name}',
    )
    const [additionalTransforms, setAdditionalTransforms] = useState(
      getActionProperty(action, IisProperties.additionalTransforms) ?? '',
    )
    const [substituteInFilesEnabled, setSubstituteInFilesEnabled] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.substituteInFilesEnabled), false),
    )
    const [substituteInFilesTargetFiles, setSubstituteInFilesTargetFiles] = useState(
      getActionProperty(action, IisProperties.substituteInFilesTargetFiles) ?? '',
    )
    const [structuredConfigEnabled, setStructuredConfigEnabled] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.structuredConfigEnabled), false),
    )
    const [structuredConfigTargets, setStructuredConfigTargets] = useState(
      getActionProperty(action, IisProperties.structuredConfigTargets) ?? '',
    )
    const [additionalPaths, setAdditionalPaths] = useState(
      getActionProperty(action, IisProperties.additionalPaths) ?? '',
    )
    const [customScriptsPreDeploy, setCustomScriptsPreDeploy] = useState(
      getActionProperty(action, IisProperties.customScriptsPreDeploy) ?? '',
    )
    const [customScriptsPostDeploy, setCustomScriptsPostDeploy] = useState(
      getActionProperty(action, IisProperties.customScriptsPostDeploy) ?? '',
    )
    const [certificatePfxBase64, setCertificatePfxBase64] = useState(
      getActionProperty(action, IisProperties.certificatePfxBase64) ?? '',
    )
    const [certificatePfxPassword, setCertificatePfxPassword] = useState(
      getActionProperty(action, IisProperties.certificatePfxPassword) ?? '',
    )
    const [certificateThumbprintVariableName, setCertificateThumbprintVariableName] = useState(
      getActionProperty(action, IisProperties.certificateThumbprintVariableName) ?? '',
    )
    const [packageSourcePath, setPackageSourcePath] = useState(
      getActionProperty(action, IisProperties.packageSourcePath) ?? '',
    )
    const [packageExtractTo, setPackageExtractTo] = useState(
      getActionProperty(action, IisProperties.packageExtractTo) ?? '',
    )
    const [packagePurgeBeforeExtract, setPackagePurgeBeforeExtract] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.packagePurgeBeforeExtract), false),
    )
    const [packageSkipIfAlreadyInstalled, setPackageSkipIfAlreadyInstalled] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.packageSkipIfAlreadyInstalled), false),
    )
    const [maxRetryFailures, setMaxRetryFailures] = useState(
      normalizeNonNegativeIntegerString(getActionProperty(action, IisProperties.maxRetryFailures)),
    )
    const [sleepBetweenRetryFailuresInSeconds, setSleepBetweenRetryFailuresInSeconds] = useState(
      normalizeNonNegativeIntegerString(getActionProperty(action, IisProperties.sleepBetweenRetryFailuresInSeconds)),
    )
    const [ignoreVariableReplacementErrors, setIgnoreVariableReplacementErrors] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.ignoreVariableReplacementErrors), false),
    )
    const [shouldFailDeploymentOnSubstitutionFails, setShouldFailDeploymentOnSubstitutionFails] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.shouldFailDeploymentOnSubstitutionFails), false),
    )
    const [enableDiagnosticsConfigTransformationLogging, setEnableDiagnosticsConfigTransformationLogging] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.enableDiagnosticsConfigTransformationLogging), false),
    )

    const initialEnabledFeatures = useMemo(() => inferEnabledFeatures(action), [action])
    const [enabledFeatures, setEnabledFeatures] = useState<ReadonlySet<IisFeatureId>>(initialEnabledFeatures)
    const [featuresModalOpen, setFeaturesModalOpen] = useState(false)
    const [featuresDraft, setFeaturesDraft] = useState<ReadonlySet<IisFeatureId>>(initialEnabledFeatures)

    const openFeaturesModal = () => {
      setFeaturesDraft(new Set(enabledFeatures))
      setFeaturesModalOpen(true)
    }

    const closeFeaturesModal = () => {
      setFeaturesModalOpen(false)
    }

    const toggleFeatureDraft = (id: IisFeatureId, checked: boolean) => {
      setFeaturesDraft((current) => {
        const next = new Set(current)
        if (checked) next.add(id)
        else next.delete(id)
        return next
      })
    }

    const saveFeatures = () => {
      setEnabledFeatures(new Set(featuresDraft))
      setFeaturesModalOpen(false)
    }

    const loadFeeds = useCallback(async () => {
      setFeedsLoading(true)
      try {
        const response = await getExternalFeeds({ pageSize: 1000 })
        const sorted = [...(response.externalFeeds ?? [])].sort((a, b) => a.name.localeCompare(b.name))
        setFeeds(sorted)
        setFeedOptions(sorted.map((feed) => ({ label: feed.name, value: String(feed.id) })))
      } catch {
        message.error('Failed to load feeds')
      } finally {
        setFeedsLoading(false)
      }
    }, [])

    useEffect(() => {
      onStepNameChange?.(stepName)
    }, [stepName, onStepNameChange])

    useEffect(() => {
      void loadFeeds()
    }, [loadFeeds])

    useEffect(() => {
      setPackageSearchTerm(packageId)
    }, [packageId])

    const selectedFeedId = useMemo(() => {
      const parsed = Number.parseInt(packageFeedId, 10)
      if (!Number.isFinite(parsed) || parsed <= 0) return null
      return parsed
    }, [packageFeedId])

    const selectedFeedName = useMemo(() => {
      if (!selectedFeedId) return ''
      return feeds.find((feed) => feed.id === selectedFeedId)?.name ?? ''
    }, [feeds, selectedFeedId])

    const feedSelectOptions = useMemo(() => {
      if (!packageFeedId.trim()) return feedOptions
      if (feedOptions.some((option) => option.value === packageFeedId)) return feedOptions
      return [...feedOptions, { label: `Feed #${packageFeedId}`, value: packageFeedId }]
    }, [feedOptions, packageFeedId])

    useEffect(() => {
      const query = packageSearchTerm.trim()
      if (!selectedFeedId || !query) {
        setPackageSearchOptions([])
        setPackageSearchLoading(false)
        return
      }

      const requestId = ++packageSearchRequestId.current
      const timer = window.setTimeout(() => {
        setPackageSearchLoading(true)
        searchExternalFeedPackages({ feedId: selectedFeedId, query, take: 20 })
          .then((response) => {
            if (requestId !== packageSearchRequestId.current) return
            setPackageSearchOptions((response.packages ?? []).filter(Boolean))
          })
          .catch(() => {
            if (requestId !== packageSearchRequestId.current) return
            setPackageSearchOptions([])
          })
          .finally(() => {
            if (requestId !== packageSearchRequestId.current) return
            setPackageSearchLoading(false)
          })
      }, 300)

      return () => window.clearTimeout(timer)
    }, [selectedFeedId, packageSearchTerm])

    const handleRemoveBinding = (bindingId: string) => {
      setBindings((current) => current.filter((binding) => binding.id !== bindingId))
    }

    const openAddBindingModal = () => {
      setEditingBindingId(null)
      setBindingDraft(createDefaultBinding())
      setBindingModalOpen(true)
    }

    const openEditBindingModal = (binding: IisBinding) => {
      setEditingBindingId(binding.id)
      setBindingDraft({ ...binding })
      setBindingModalOpen(true)
    }

    const closeBindingModal = () => {
      setBindingModalOpen(false)
      setEditingBindingId(null)
    }

    const saveBindingDraft = () => {
      if (!bindingDraft.port.trim()) {
        message.warning('Port is required')
        return
      }

      if (editingBindingId) {
        setBindings((current) => current.map((binding) => (
          binding.id === editingBindingId
            ? { ...bindingDraft, id: editingBindingId }
            : binding
        )))
      } else {
        setBindings((current) => [...current, { ...bindingDraft, id: createDefaultBinding().id }])
      }

      closeBindingModal()
    }

    const handleSave = async () => {
      const normalizedStepName = stepName.trim()
      if (!normalizedStepName) {
        message.warning('Step name is required')
        return
      }

      if (targetTags.length === 0) {
        message.warning('You need at least one target tag')
        return
      }

      if (!packageFeedId.trim() || !packageId.trim()) {
        message.warning('Package feed and package ID are required')
        return
      }

      if (!webSiteName.trim()) {
        message.warning('Web site name is required')
        return
      }

      if (deploymentType === 'virtualDirectory' && !virtualDirectoryName.trim()) {
        message.warning('Virtual path is required')
        return
      }

      if (deploymentType === 'webApplication' && !webApplicationName.trim()) {
        message.warning('Virtual path is required')
        return
      }

      if (physicalPathMode === 'relativeToPackageRoot' && !relativePath.trim()) {
        message.warning('Relative path is required when using relative physical path')
        return
      }

      if (deploymentType !== 'virtualDirectory' && !appPoolName.trim()) {
        message.warning('Application pool name is required')
        return
      }

      if (deploymentType !== 'virtualDirectory' && appPoolIdentity === 'SpecificUser' && !appPoolUsername.trim()) {
        message.warning('Username is required when using a custom application pool identity')
        return
      }

      if (deploymentType === 'webSite') {
        const hasBindingWithoutPort = bindings.some((binding) => binding.enabled && !binding.port.trim())
        if (hasBindingWithoutPort) {
          message.warning('Each enabled binding must include a port')
          return
        }

        const httpsBindingMissingCert = bindings.some((binding) =>
          binding.enabled
          && binding.protocol === 'https'
          && !binding.thumbprint.trim()
          && !binding.certificateVariable.trim(),
        )
        if (httpsBindingMissingCert) {
          message.warning('Each enabled HTTPS binding must reference a certificate (thumbprint or certificate variable)')
          return
        }
      }

      if (substituteInFilesEnabled && !substituteInFilesTargetFiles.trim()) {
        message.warning('Substitute in Files target files are required when this feature is enabled')
        return
      }

      if (structuredConfigEnabled && !structuredConfigTargets.trim()) {
        message.warning('Structured Configuration Variables targets are required when this feature is enabled')
        return
      }

      if (certificatePfxBase64.trim() && !certificateThumbprintVariableName.trim()) {
        message.warning('Certificate thumbprint variable name is required when PFX content is provided (so bindings can reference the imported cert)')
        return
      }

      if (packageSourcePath.trim() && !/\.(zip|nupkg)$/i.test(packageSourcePath.trim())) {
        message.warning('Package source path must end with .zip or .nupkg')
        return
      }

      if (maxRetryFailures.trim() && !/^\d+$/.test(maxRetryFailures.trim())) {
        message.warning('Max retry failures must be a non-negative integer')
        return
      }

      if (sleepBetweenRetryFailuresInSeconds.trim()) {
        const seconds = Number.parseInt(sleepBetweenRetryFailuresInSeconds.trim(), 10)
        if (!Number.isFinite(seconds) || seconds < 0 || seconds > 60) {
          message.warning('Sleep between retry failures must be a number from 0 to 60 (seconds)')
          return
        }
      }

      const actionValues: IisActionValues = {
        packageFeedId,
        packageId,
        packageVersion,
        deploymentType,
        webSiteName,
        virtualDirectoryName,
        webApplicationName,
        physicalPathMode,
        relativePath,
        startWebSite,
        appPoolName,
        appPoolClrVersion,
        appPoolIdentity,
        appPoolUsername,
        appPoolPassword,
        startAppPool,
        bindings,
        existingBindings,
        authAnonymous,
        authBasic,
        authWindows,
        replaceConfigVariables,
        runConfigTransforms,
        configTransformsEnvironmentName,
        additionalTransforms,
        substituteInFilesEnabled,
        substituteInFilesTargetFiles,
        structuredConfigEnabled,
        structuredConfigTargets,
        additionalPaths,
        customScriptsPreDeploy,
        customScriptsPostDeploy,
        certificatePfxBase64,
        certificatePfxPassword,
        certificateThumbprintVariableName,
        packageSourcePath,
        packageExtractTo,
        packagePurgeBeforeExtract,
        packageSkipIfAlreadyInstalled,
        maxRetryFailures,
        sleepBetweenRetryFailuresInSeconds,
        ignoreVariableReplacementErrors,
        shouldFailDeploymentOnSubstitutionFails,
        enableDiagnosticsConfigTransformationLogging,
        enabledFeatures,
      }
      const actionProperties = buildActionProperties(action, actionValues)
      const stepProperties = buildStepProperties(step?.properties, step?.id ?? 0, conditions, targetTags)
      const actionEnvironments = conditions.environmentMode === 'include' ? conditions.environmentIds : []
      const actionExcludedEnvironments = conditions.environmentMode === 'exclude' ? conditions.environmentIds : []

      const nextAction: DeploymentActionDto = {
        id: action?.id ?? 0,
        stepId: step?.id ?? 0,
        actionOrder: action?.actionOrder ?? 0,
        name: normalizedStepName,
        actionType: ACTION_TYPE,
        workerPoolId: action?.workerPoolId ?? null,
        isDisabled: conditions.disabled,
        isRequired: action?.isRequired ?? false,
        canBeUsedForProjectVersioning: action?.canBeUsedForProjectVersioning ?? false,
        createdAt: action?.createdAt ?? new Date().toISOString(),
        properties: actionProperties,
        environments: actionEnvironments,
        excludedEnvironments: actionExcludedEnvironments,
        channels: conditions.channelIds,
      }

      const nextStep: DeploymentStepDto = {
        id: step?.id ?? 0,
        processId,
        stepOrder: step?.stepOrder ?? 0,
        name: normalizedStepName,
        stepType: step?.stepType ?? 'Action',
        condition: conditions.runCondition,
        startTrigger,
        packageRequirement: conditions.packageRequirement,
        isDisabled: conditions.disabled,
        isRequired: conditions.required,
        createdAt: step?.createdAt ?? new Date().toISOString(),
        properties: stepProperties,
        actions: [nextAction],
      }

      try {
        const saved = step
          ? await updateDeploymentStep({ id: step.id, step: nextStep })
          : await createDeploymentStep({ processId, step: nextStep })
        message.success(step ? 'Step updated' : 'Step created')
        onSave(saved)
      } catch {
        message.error('Failed to save step')
      }
    }

    useImperativeHandle(ref, () => ({ save: handleSave }), [
      stepName,
      targetTags,
      startTrigger,
      conditions,
      packageFeedId,
      packageId,
      packageVersion,
      deploymentType,
      webSiteName,
      virtualDirectoryName,
      webApplicationName,
      physicalPathMode,
      relativePath,
      startWebSite,
      appPoolName,
      appPoolClrVersion,
      appPoolIdentity,
      appPoolUsername,
      appPoolPassword,
      startAppPool,
      bindings,
      existingBindings,
      authAnonymous,
      authBasic,
      authWindows,
      replaceConfigVariables,
      runConfigTransforms,
      configTransformsEnvironmentName,
      additionalTransforms,
      substituteInFilesEnabled,
      substituteInFilesTargetFiles,
      structuredConfigEnabled,
      structuredConfigTargets,
      additionalPaths,
      customScriptsPreDeploy,
      customScriptsPostDeploy,
      certificatePfxBase64,
      certificatePfxPassword,
      certificateThumbprintVariableName,
      packageSourcePath,
      packageExtractTo,
      packagePurgeBeforeExtract,
      packageSkipIfAlreadyInstalled,
      maxRetryFailures,
      sleepBetweenRetryFailuresInSeconds,
      ignoreVariableReplacementErrors,
      shouldFailDeploymentOnSubstitutionFails,
      enableDiagnosticsConfigTransformationLogging,
      enabledFeatures,
      step,
      processId,
    ])

    const logoUrl = `${API_BASE}/${spaceId}/actiontemplates/${ACTION_TYPE}/logo`
    const displayName = stepName.trim() || DEFAULT_STEP_NAME
    const isVirtualDirectory = deploymentType === 'virtualDirectory'
    const isWebApplication = deploymentType === 'webApplication'
    const iisTargetSectionTitle = isVirtualDirectory ? 'Virtual Directory' : isWebApplication ? 'Web Application' : 'Web Site'
    const iisTargetSectionSubtitle = isVirtualDirectory
      ? 'Configure the details of the IIS Virtual Directory.'
      : isWebApplication
        ? 'Configure the details of the IIS Web Application'
        : 'Configure the details of the IIS Web Site.'
    const webSiteNameLabel = deploymentType === 'webSite' ? 'Web site name' : 'Parent web site name'
    const webSiteNameHelp = isVirtualDirectory
      ? 'The name of the parent Web Site for this Virtual Directory in IIS. The Web Site should already exist when this step runs.'
      : isWebApplication
        ? 'The name of the parent Web Site for this Web Application in IIS. The Web Site should already exist when this step runs.'
        : 'The display name of the IIS Web Site to create or reconfigure.'
    const childPathLabel = isVirtualDirectory || isWebApplication ? 'Virtual path' : 'Web application name'
    const childPathHelp = isVirtualDirectory
      ? (
        <>
          The virtual path in IIS relative to the parent Web Site. E.g. <code>/application1/directory2/mydirectory</code>.
          <br />
          Note: All parent directories/applications must already exist.
        </>
      )
      : (
        <>
          The virtual path in IIS relative to the parent Web Site. E.g. <code>/myapplication</code>.
          <br />
          Note: All parent directories/applications must already exist.
        </>
      )
    const packageRootTargetName = isWebApplication ? 'IIS Web Application' : isVirtualDirectory ? 'Virtual Directory' : 'IIS Web Site'
    const relativePathTargetName = isWebApplication ? 'Web Application' : isVirtualDirectory ? 'Virtual Directory' : 'IIS Web Site'
    const childPathValue = deploymentType === 'virtualDirectory' ? virtualDirectoryName : webApplicationName
    const childPathSetter = deploymentType === 'virtualDirectory' ? setVirtualDirectoryName : setWebApplicationName

    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-slate-100">
              <img
                src={logoUrl}
                alt="Logo"
                className="h-full w-full object-contain"
                onError={(event) => {
                  ;(event.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="text-xs leading-tight text-slate-400">Deploy to IIS</div>
              <div className="flex items-center gap-1.5">
                {stepIndex != null ? <span className="text-sm font-medium text-slate-400">{stepIndex + 1}.</span> : null}
                <span className="truncate text-sm font-semibold text-slate-800">{displayName}</span>
              </div>
            </div>
          </div>

          <button className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100" aria-label="More Step Actions">
            <MoreOutlined style={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <CollapsibleSection title="Step Name" subtitle="A short, memorable, unique name for this step." defaultOpen>
            <label className="mb-1 block text-xs font-medium text-slate-600">Step name</label>
            <Input
              size="small"
              value={stepName}
              onChange={(event) => setStepName(event.target.value)}
              placeholder={DEFAULT_STEP_NAME}
            />
            <Button type="link" className="!h-auto !px-0 !text-xs">Add notes</Button>
          </CollapsibleSection>

          <CollapsibleSection title="Target Tags" subtitle="This step will deploy to deployment targets with any of these matching tags." defaultOpen>
            <TargetTagSelect
              value={targetTags}
              onChange={setTargetTags}
              placeholder="Runs on targets with tags (type to add new)"
            />
            <div className="text-xs text-slate-500">You need at least one tag to select matching targets.</div>
          </CollapsibleSection>

          <CollapsibleSection title="Package Details" subtitle="Configure package source and version for IIS deployment." defaultOpen fullWidth>
            <CollapsibleSection title="Package" subtitle="Select the package containing your application." defaultOpen fullWidth>
              <div className="ml-[216px] space-y-4">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Package feed</label>
                    <Select
                      value={packageFeedId || undefined}
                      options={feedSelectOptions}
                      onChange={(value) => {
                        const normalizedValue = String(value ?? '').trim()
                        setPackageFeedId(normalizedValue)
                        if (!normalizedValue) {
                          setPackageId('')
                          setPackageSearchTerm('')
                          setPackageSearchOptions([])
                          return
                        }
                        setPackageSearchTerm(packageId)
                      }}
                      size="small"
                      className="w-full"
                      showSearch
                      loading={feedsLoading}
                      allowClear
                      optionFilterProp="label"
                      placeholder="Select a feed..."
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                    aria-label="Refresh feeds"
                    onClick={() => void loadFeeds()}
                  >
                    <ReloadOutlined style={{ fontSize: 13 }} />
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Package ID</label>
                  <div className="flex min-h-[28px] items-center gap-2">
                    <AutoComplete
                      size="small"
                      className="w-full min-w-0"
                      value={packageId}
                      placeholder="Package ID"
                      options={packageSearchOptions.map((value) => ({ value }))}
                      onSearch={setPackageSearchTerm}
                      onSelect={(value) => {
                        setPackageSearchTerm(value)
                        setPackageId(value)
                      }}
                      onChange={(value) => {
                        setPackageSearchTerm(value)
                        setPackageId(value)
                      }}
                      filterOption={false}
                      allowClear
                      notFoundContent={
                        selectedFeedId && packageSearchTerm.trim()
                          ? packageSearchLoading
                            ? 'Searching packages...'
                            : 'No packages found'
                          : null
                      }
                    />
                  </div>
                  <p className="mb-0 mt-4 text-xs leading-relaxed text-slate-500">
                    Enter the ID of the package.
                    {selectedFeedName ? <> Searching in <code>{selectedFeedName}</code>.</> : null}
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Version (optional)</label>
                  <Input
                    size="small"
                    value={packageVersion}
                    onChange={(event) => setPackageVersion(event.target.value)}
                    placeholder="1.0.0"
                  />
                  <p className="mb-0 mt-1 text-xs text-slate-500">Package will be locked to this version.</p>
                </div>
              </div>
            </CollapsibleSection>
          </CollapsibleSection>

          <CollapsibleSection title="IIS Web Site and Application Pool" subtitle="Configure IIS deployment mode, website, app pool, bindings, and auth." defaultOpen fullWidth>
            <CollapsibleSection title="IIS Deployment Type" subtitle="Configure the type of deployment." defaultOpen>
              <p className="m-0 text-xs text-slate-500">
                Learn more about deploying{' '}
                <a
                  href="https://oc.to/IISWebsitesAndApplications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-squid-blue hover:underline"
                >
                  IIS Websites and Applications
                </a>.
              </p>
              <Radio.Group
                value={deploymentType}
                onChange={(event) => setDeploymentType(event.target.value as IisDeploymentType)}
                className="flex flex-col gap-3"
              >
                <Radio value="webSite">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-slate-700">IIS Web Site</span>
                    <span className="text-xs text-slate-500">Create or update an IIS Web Site</span>
                  </div>
                </Radio>
                <Radio value="virtualDirectory">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-slate-700">IIS Virtual Directory</span>
                    <span className="text-xs text-slate-500">Create or update an IIS Virtual Directory as a child of an existing IIS Web Site</span>
                  </div>
                </Radio>
                <Radio value="webApplication">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-slate-700">IIS Web Application</span>
                    <span className="text-xs text-slate-500">Create or update an IIS Web Application as a child of an existing IIS Web Site</span>
                  </div>
                </Radio>
              </Radio.Group>
            </CollapsibleSection>

            <CollapsibleSection title={iisTargetSectionTitle} subtitle={iisTargetSectionSubtitle} defaultOpen fullWidth>
              <div className="ml-[216px] space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{webSiteNameLabel}</label>
                  <Input
                    size="small"
                    value={webSiteName}
                    onChange={(event) => setWebSiteName(event.target.value)}
                    placeholder="Default Web Site"
                  />
                  <p className="mb-0 mt-1 text-xs text-slate-500">{webSiteNameHelp}</p>
                </div>

                {deploymentType !== 'webSite' ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{childPathLabel}</label>
                    <Input
                      size="small"
                      value={childPathValue}
                      onChange={(event) => childPathSetter(event.target.value)}
                      placeholder={deploymentType === 'virtualDirectory' ? 'app' : 'app'}
                    />
                    <p className="mb-0 mt-1 text-xs text-slate-500">{childPathHelp}</p>
                  </div>
                ) : null}

                <div>
                  <div className="mb-2 text-xs font-medium text-slate-600">Physical path</div>
                  <Radio.Group
                    value={physicalPathMode}
                    onChange={(event) => setPhysicalPathMode(event.target.value as PhysicalPathMode)}
                    className="flex flex-col gap-2"
                  >
                    <Radio value="packageRoot">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm">Package installation directory</span>
                        <span className="text-xs text-slate-500">
                          Configure this {packageRootTargetName} to serve content from the folder that Squid extracted the package to, or the Custom Installation Directory if specified.
                        </span>
                      </div>
                    </Radio>
                    <Radio value="relativeToPackageRoot">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm">Relative path under package installation directory</span>
                        <span className="text-xs text-slate-500">
                          Configure this {relativePathTargetName} to serve content from a path that is relative to the folder that Squid extracted the package to, or the Custom Installation Directory if specified.
                        </span>
                      </div>
                    </Radio>
                  </Radio.Group>
                </div>

                {physicalPathMode === 'relativeToPackageRoot' ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Relative path</label>
                    <Input
                      size="small"
                      value={relativePath}
                      onChange={(event) => setRelativePath(event.target.value)}
                      placeholder="site"
                    />
                  </div>
                ) : null}

                {deploymentType === 'webSite' ? (
                  <Checkbox checked={startWebSite} onChange={(event) => setStartWebSite(event.target.checked)}>
                    <span className="text-sm">Start IIS Web Site</span>
                  </Checkbox>
                ) : null}
              </div>
            </CollapsibleSection>

            {deploymentType !== 'virtualDirectory' ? (
              <CollapsibleSection title="Application Pool" subtitle="Configure the details of the IIS Application Pool that will be created and used." defaultOpen fullWidth>
                <div className="ml-[216px] space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Application Pool name</label>
                    <Input
                      size="small"
                      value={appPoolName}
                      onChange={(event) => setAppPoolName(event.target.value)}
                      placeholder="MyAppPool"
                    />
                    <p className="mb-0 mt-1 text-xs text-slate-500">Name of the application pool in IIS to create or reconfigure.</p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">.NET CLR version</label>
                    <Select
                      value={appPoolClrVersion}
                      onChange={(value) => setAppPoolClrVersion(value as AppPoolClrVersion)}
                      options={[
                        { label: 'v4.0', value: 'v4.0' },
                        { label: 'v2.0', value: 'v2.0' },
                        { label: 'No Managed Code', value: 'No Managed Code' },
                      ]}
                      size="small"
                      className="w-full"
                    />
                    <p className="mb-0 mt-2 text-xs text-slate-500">
                      The version of the .NET common language runtime that this application pool will use. Choose <strong>v2.0</strong> for applications built against .NET 2.0, 3.0 or 3.5. Choose <strong>v4.0</strong> for .NET 4.0 or 4.5
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Identity</label>
                    <Select
                      value={appPoolIdentity}
                      onChange={(value) => setAppPoolIdentity(value as AppPoolIdentity)}
                      options={[
                        { label: 'Application Pool Identity', value: 'ApplicationPoolIdentity' },
                        { label: 'Network Service', value: 'NetworkService' },
                        { label: 'Local Service', value: 'LocalService' },
                        { label: 'Local System', value: 'LocalSystem' },
                        { label: 'Custom user (Specific User)', value: 'SpecificUser' },
                      ]}
                      size="small"
                      className="w-full"
                    />
                    <p className="mb-0 mt-2 text-xs text-slate-500">Which account will the application pool run under.</p>
                  </div>

                  {appPoolIdentity === 'SpecificUser' ? (
                    <>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Username</label>
                        <Input
                          size="small"
                          value={appPoolUsername}
                          onChange={(event) => setAppPoolUsername(event.target.value)}
                          placeholder={'DOMAIN\\user or .\\user'}
                          autoComplete="off"
                        />
                        <p className="mb-0 mt-1 text-xs text-slate-500">
                          The Windows account the application pool will run under. Use <code>DOMAIN\user</code> for a domain account or <code>.\user</code> for a local account.
                        </p>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Password</label>
                        <Input.Password
                          size="small"
                          value={appPoolPassword}
                          onChange={(event) => setAppPoolPassword(event.target.value)}
                          placeholder="Password or #{Sensitive.AppPoolPassword}"
                          autoComplete="new-password"
                          visibilityToggle
                        />
                        <p className="mb-0 mt-1 text-xs text-slate-500">
                          The password for the account. Reference a sensitive variable (e.g. <code>#{'{Sensitive.AppPoolPassword}'}</code>) to avoid storing the secret in the step definition.
                        </p>
                      </div>
                    </>
                  ) : null}

                  <div>
                    <Checkbox checked={startAppPool} onChange={(event) => setStartAppPool(event.target.checked)}>
                      <span className="text-sm">Start IIS Application Pool</span>
                    </Checkbox>
                    <p className="mb-0 mt-1 text-xs text-slate-500">Whether the deployment step should start the IIS Application Pool after a successful deployment or not.</p>
                  </div>
                </div>
              </CollapsibleSection>
            ) : null}

            {deploymentType === 'webSite' ? (
              <>
                <CollapsibleSection title="Bindings" subtitle="Bindings define what protocols, ports and host names this site will listen on." defaultOpen fullWidth>
                  <div className="ml-[216px] space-y-4">
                    <div className="w-full max-w-[520px] space-y-2">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={openAddBindingModal}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
                        >
                          <PlusOutlined style={{ fontSize: 11 }} />
                          Add
                        </button>
                      </div>

                      {bindings.length > 0 ? (
                        <ul className="space-y-2">
                          {bindings.map((binding) => (
                            <li
                              key={binding.id}
                              className="flex items-start justify-between gap-3 border border-slate-200 rounded p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                              onClick={() => openEditBindingModal(binding)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  openEditBindingModal(binding)
                                }
                              }}
                            >
                              <div className="text-sm text-slate-700 space-y-1">
                                <p className="mb-0">Protocol: <strong>{binding.protocol}</strong></p>
                                <p className="mb-0">Port: <strong>{binding.port || '(not set)'}</strong></p>
                                {binding.ipAddress.trim() ? <p className="mb-0">IP: <strong>{binding.ipAddress}</strong></p> : null}
                                {binding.hostName.trim() ? <p className="mb-0">Host: <strong>{binding.hostName}</strong></p> : null}
                                {binding.protocol === 'https' && binding.certificateVariable.trim() ? (
                                  <p className="mb-0">Cert variable: <strong>{binding.certificateVariable}</strong></p>
                                ) : null}
                                {binding.protocol === 'https' && !binding.certificateVariable.trim() && binding.thumbprint.trim() ? (
                                  <p className="mb-0">Cert thumbprint: <strong>{binding.thumbprint.slice(0, 12)}{binding.thumbprint.length > 12 ? '…' : ''}</strong></p>
                                ) : null}
                                {binding.protocol === 'https' && binding.requireSni ? <p className="mb-0">SNI: <strong>required</strong></p> : null}
                                {!binding.enabled ? <p className="mb-0 text-amber-600">Disabled</p> : null}
                              </div>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleRemoveBinding(binding.id)
                                }}
                                className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                aria-label="Remove binding"
                              >
                                <CloseOutlined style={{ fontSize: 13 }} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mb-0 text-xs text-slate-500">No bindings configured yet.</p>
                      )}
                    </div>

                    <Modal
                      title={editingBindingId ? 'Edit Binding' : 'Add Binding'}
                      open={bindingModalOpen}
                      onCancel={closeBindingModal}
                      onOk={saveBindingDraft}
                      okText={editingBindingId ? 'Save' : 'Add'}
                      cancelText="Cancel"
                    >
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Protocol</label>
                          <Select
                            value={bindingDraft.protocol}
                            onChange={(value) => setBindingDraft((current) => ({
                              ...current,
                              protocol: value as BindingProtocol,
                              port: current.port.trim().length > 0
                                ? current.port
                                : value === 'https'
                                  ? '443'
                                  : '80',
                            }))}
                            className="w-full"
                            options={[
                              { label: 'HTTP', value: 'http' },
                              { label: 'HTTPS', value: 'https' },
                              { label: 'net.tcp', value: 'net.tcp' },
                              { label: 'net.pipe', value: 'net.pipe' },
                              { label: 'net.msmq', value: 'net.msmq' },
                              { label: 'msmq.formatname', value: 'msmq.formatname' },
                            ]}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Port</label>
                          <Input
                            value={bindingDraft.port}
                            onChange={(event) => setBindingDraft((current) => ({ ...current, port: event.target.value }))}
                            placeholder={bindingDraft.protocol === 'https' ? '443' : '80'}
                          />
                          <p className="text-xs text-slate-500 leading-relaxed mt-1 mb-0">
                            The TCP port number that this binding will listen on.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">IP address</label>
                          <Input
                            value={bindingDraft.ipAddress}
                            onChange={(event) => setBindingDraft((current) => ({ ...current, ipAddress: event.target.value }))}
                            placeholder="*"
                          />
                          <p className="text-xs text-slate-500 leading-relaxed mt-1 mb-0">
                            Use <code>*</code> for any address, or specify an address such as <code>10.0.0.1</code>.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Host name</label>
                          <Input
                            value={bindingDraft.hostName}
                            onChange={(event) => setBindingDraft((current) => ({ ...current, hostName: event.target.value }))}
                            placeholder="www.contoso.com"
                          />
                          <p className="text-xs text-slate-500 leading-relaxed mt-1 mb-0">
                            Leave empty to use any host header.
                          </p>
                        </div>

                        {bindingDraft.protocol === 'https' ? (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Certificate variable name</label>
                              <Input
                                value={bindingDraft.certificateVariable}
                                onChange={(event) => setBindingDraft((current) => ({ ...current, certificateVariable: event.target.value }))}
                                placeholder="OrderApiCert"
                              />
                              <p className="text-xs text-slate-500 leading-relaxed mt-1 mb-0">
                                When set, the agent reads <code>${'{VarName}'}.Thumbprint</code> from Squid variables (typically populated by the HTTPS Certificate auto-import section below). Takes precedence over the static thumbprint.
                              </p>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Certificate thumbprint</label>
                              <Input
                                value={bindingDraft.thumbprint}
                                onChange={(event) => setBindingDraft((current) => ({ ...current, thumbprint: event.target.value }))}
                                placeholder="ABCD1234… (LocalMachine\\My)"
                              />
                              <p className="text-xs text-slate-500 leading-relaxed mt-1 mb-0">
                                Fallback when no variable is set. The cert must already exist in <code>Cert:\LocalMachine\My</code> on the agent.
                              </p>
                            </div>

                            <div>
                              <Checkbox
                                checked={bindingDraft.requireSni}
                                onChange={(event) => setBindingDraft((current) => ({ ...current, requireSni: event.target.checked }))}
                              >
                                <span className="text-sm">Require Server Name Indication (SNI)</span>
                              </Checkbox>
                              <p className="text-xs text-slate-500 leading-relaxed mt-1 mb-0">
                                Bind the certificate to the hostname instead of the IP/port pair. Useful when multiple HTTPS sites share an IP. Requires IIS 8+.
                              </p>
                            </div>
                          </>
                        ) : null}

                        <div>
                          <div className="text-xs font-medium text-slate-600 mb-2">Binding status</div>
                          <Checkbox
                            checked={bindingDraft.enabled}
                            onChange={(event) => setBindingDraft((current) => ({ ...current, enabled: event.target.checked }))}
                          >
                            <span className="text-sm">Enabled</span>
                          </Checkbox>
                          <p className="text-xs text-slate-500 leading-relaxed mt-1 mb-0">
                            Disable this binding to skip it (the binding will not be added).
                          </p>
                        </div>
                      </div>
                    </Modal>

                    <div>
                      <div className="mb-2 text-xs font-medium text-slate-600">Existing Bindings</div>
                      <Radio.Group
                        value={existingBindings}
                        onChange={(event) => setExistingBindings(event.target.value as ExistingBindingsMode)}
                        className="flex flex-col gap-2"
                      >
                        <Radio value="Replace">
                          <span className="text-sm">Replace existing bindings <span className="text-slate-500">(default)</span></span>
                        </Radio>
                        <Radio value="Merge">
                          <span className="text-sm">Merge with existing bindings</span>
                        </Radio>
                      </Radio.Group>
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="IIS Authentication" subtitle="Set which authentication modes will be enabled in IIS." defaultOpen fullWidth>
                  <div className="ml-[216px] space-y-3">
                    <div>
                      <Checkbox checked={authAnonymous} onChange={(event) => setAuthAnonymous(event.target.checked)}>
                        <span className="text-sm">Enable Anonymous authentication</span>
                      </Checkbox>
                      <p className="mb-0 mt-1 text-xs text-slate-500">Whether IIS should allow anonymous authentication.</p>
                    </div>

                    <div>
                      <Checkbox checked={authBasic} onChange={(event) => setAuthBasic(event.target.checked)}>
                        <span className="text-sm">Enable Basic authentication</span>
                      </Checkbox>
                      <p className="mb-0 mt-1 text-xs text-slate-500">Whether IIS should allow basic authentication with a 401 challenge.</p>
                    </div>

                    <div>
                      <Checkbox checked={authWindows} onChange={(event) => setAuthWindows(event.target.checked)}>
                        <span className="text-sm">Enable Windows authentication</span>
                      </Checkbox>
                      <p className="mb-0 mt-1 text-xs text-slate-500">Whether IIS should allow integrated Windows authentication with a 401 challenge.</p>
                    </div>
                  </div>
                </CollapsibleSection>
              </>
            ) : null}
          </CollapsibleSection>

          {enabledFeatures.has('Squid.Features.ConfigurationVariables') ? (
            <CollapsibleSection
              title=".NET Configuration Variables"
              subtitle="If set, replace appSettings and connectionString entries in any .config files."
              defaultOpen
            >
              <Checkbox checked={replaceConfigVariables} onChange={(event) => setReplaceConfigVariables(event.target.checked)}>
                <span className="text-sm">Replace entries in .config files</span>
              </Checkbox>
              <p className="mb-0 mt-1 text-xs text-slate-500">
                Tentacle will scan <code>.config</code> files and replace matching keys using step variables.
              </p>
            </CollapsibleSection>
          ) : null}

          {enabledFeatures.has('Squid.Features.ConfigurationTransforms') ? (
          <CollapsibleSection
            title=".NET Configuration Transforms"
            subtitle="Configure .NET XML configuration transforms."
            defaultOpen
            fullWidth
          >
            <div className="ml-[216px] w-2/3 max-w-[760px] space-y-4">
              <div>
                <Checkbox checked={runConfigTransforms} onChange={(event) => setRunConfigTransforms(event.target.checked)}>
                  <span className="text-sm">Run default XML transforms</span>
                </Checkbox>
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  Squid can run configuration transformation files. By default Squid looks for <em>*.Release.config</em> and <em>*.&lt;EnvironmentName&gt;.config</em>.
                </p>
              </div>

              {runConfigTransforms ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Environment name token</label>
                  <Input
                    size="small"
                    value={configTransformsEnvironmentName}
                    onChange={(event) => setConfigTransformsEnvironmentName(event.target.value)}
                    placeholder="#{Squid.Environment.Name}"
                  />
                  <p className="mb-0 mt-1 text-xs text-slate-500">
                    Picks the <code>*.&lt;name&gt;.config</code> overlay. Leave empty to apply only the Release transform.
                  </p>
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Additional transforms</label>
                <Input.TextArea
                  value={additionalTransforms}
                  onChange={(event) => setAdditionalTransforms(event.target.value)}
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  placeholder="Web.Release.config => Web.config"
                />
                <div className="mt-2 space-y-2 text-xs leading-relaxed text-slate-500">
                  <p className="mb-0">A comma- or newline-separated list of additional configuration transformation file rules. Example:</p>
                  <pre className="mb-0 whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-600">
                    {'Web.Release.config => Web.config\n*.Foo.config => *.config\ncrossdomainpolicy.#{Squid.Environment.Name}.xml => crossdomainpolicy.xml'}
                  </pre>
                  <p className="mb-0">
                    If your configuration file is named <em>Bar.xml</em>, and your transformation file is named <em>Foo.xml</em>, enter <em>Foo.xml=&gt;Bar.xml</em>. Wildcards are supported, so transform files like <em>xyz.Foo.config</em> and <em>abc.Foo.config</em> can target matching config files with <em>*.Foo.config=&gt;*.Bar.config</em>.
                  </p>
                  <p className="mb-0">
                    For more information and advanced examples check{' '}
                    <a className="text-squid-blue hover:underline" href="https://oc.to/ConfigurationTransforms" target="_blank" rel="noreferrer noopener">
                      the documentation
                    </a>.
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleSection>
          ) : null}

          {enabledFeatures.has('Squid.Features.SubstituteInFiles') ? (
          <CollapsibleSection
            title="Substitute Variables in Files"
            subtitle="Replace #{Variable} tokens inside any text file (JSON / YAML / properties / .config / .txt)."
            fullWidth
          >
            <div className="ml-[216px] w-2/3 max-w-[760px] space-y-4">
              <Checkbox checked={substituteInFilesEnabled} onChange={(event) => setSubstituteInFilesEnabled(event.target.checked)}>
                <span className="text-sm">Enable variable token replacement in files</span>
              </Checkbox>

              {substituteInFilesEnabled ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Target files</label>
                  <Input.TextArea
                    value={substituteInFilesTargetFiles}
                    onChange={(event) => setSubstituteInFilesTargetFiles(event.target.value)}
                    autoSize={{ minRows: 3, maxRows: 8 }}
                    placeholder={'appsettings.json\nappsettings.#{Squid.Environment.Name}.json\n*.yml'}
                  />
                  <p className="mb-0 mt-1 text-xs text-slate-500">
                    Newline-separated globs relative to the web root (or absolute paths). Every <code>#{'{VariableName}'}</code> token is replaced with the matching Squid variable; unmatched tokens are left intact unless <em>Fail deployment on unresolved tokens</em> is enabled in <em>Error Tolerance</em>.
                  </p>
                </div>
              ) : null}
            </div>
          </CollapsibleSection>
          ) : null}

          {enabledFeatures.has('Squid.Features.JsonConfigurationVariables') ? (
          <CollapsibleSection
            title="Structured Configuration Variables"
            subtitle="Replace JSON leaves where the path matches a Squid variable (e.g. Logging:LogLevel:Default)."
            fullWidth
          >
            <div className="ml-[216px] w-2/3 max-w-[760px] space-y-4">
              <Checkbox checked={structuredConfigEnabled} onChange={(event) => setStructuredConfigEnabled(event.target.checked)}>
                <span className="text-sm">Enable JSON leaf replacement</span>
              </Checkbox>

              {structuredConfigEnabled ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Target files</label>
                  <Input.TextArea
                    value={structuredConfigTargets}
                    onChange={(event) => setStructuredConfigTargets(event.target.value)}
                    autoSize={{ minRows: 3, maxRows: 8 }}
                    placeholder={'appsettings.json\nappsettings.Production.json'}
                  />
                  <p className="mb-0 mt-1 text-xs text-slate-500">
                    Newline-separated globs relative to the web root. Path forms <code>Logging.LogLevel.Default</code> and <code>Logging:LogLevel:Default</code> are both supported.
                  </p>
                </div>
              ) : null}
            </div>
          </CollapsibleSection>
          ) : null}

          <CollapsibleSection
            title="Additional Configuration Paths"
            subtitle="Extra directories scanned by every config rewriter (in addition to the web root)."
            fullWidth
          >
            <div className="ml-[216px] w-2/3 max-w-[760px] space-y-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Paths (one per line)</label>
              <Input.TextArea
                value={additionalPaths}
                onChange={(event) => setAdditionalPaths(event.target.value)}
                autoSize={{ minRows: 3, maxRows: 8 }}
                placeholder={'C:\\inetpub\\OrderApi\\config\nC:\\inetpub\\OrderApi\\shared'}
              />
              <p className="mb-0 mt-1 text-xs text-slate-500">
                Absolute directory paths scanned in addition to the web root by Substitute in Files, Configuration Transforms, Configuration Variables, and Structured Configuration Variables.
              </p>
            </div>
          </CollapsibleSection>

          {enabledFeatures.has('Squid.Features.CustomScripts') ? (
          <CollapsibleSection
            title="Custom Scripts"
            subtitle="Run PowerShell before / after the IIS configuration step (e.g. Stop-WebAppPool, health check)."
            fullWidth
          >
            <div className="ml-[216px] w-2/3 max-w-[760px] space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Pre-deploy script (PowerShell)</label>
                <Input.TextArea
                  value={customScriptsPreDeploy}
                  onChange={(event) => setCustomScriptsPreDeploy(event.target.value)}
                  autoSize={{ minRows: 4, maxRows: 16 }}
                  placeholder={'# Release file locks before deployment\nStop-WebAppPool $applicationPoolName'}
                />
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  Runs before the IIS configuration logic. <code>WebAdministration</code> is auto-imported and <code>$SquidParameters</code> / <code>$SquidVariables</code> are available.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Post-deploy script (PowerShell)</label>
                <Input.TextArea
                  value={customScriptsPostDeploy}
                  onChange={(event) => setCustomScriptsPostDeploy(event.target.value)}
                  autoSize={{ minRows: 4, maxRows: 16 }}
                  placeholder={'# Smoke test after deployment\nStart-WebAppPool $applicationPoolName\nInvoke-WebRequest http://localhost/health -UseBasicParsing'}
                />
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  Runs after a successful IIS configuration step. Skipped if the configure step threw.
                </p>
              </div>
            </div>
          </CollapsibleSection>
          ) : null}

          <CollapsibleSection
            title="HTTPS Certificate"
            subtitle="Auto-import a PFX into Cert:\LocalMachine\My on the agent so HTTPS bindings can reference it."
            fullWidth
          >
            <div className="ml-[216px] w-2/3 max-w-[760px] space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">PFX content (base64 or variable reference)</label>
                <Input.TextArea
                  value={certificatePfxBase64}
                  onChange={(event) => setCertificatePfxBase64(event.target.value)}
                  autoSize={{ minRows: 2, maxRows: 6 }}
                  placeholder={'#{Sensitive.OrderApiPfx}'}
                />
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  Recommended pattern: store the base64-encoded PFX bytes as a sensitive Squid variable and reference it via <code>#{'{Sensitive.MyPfx}'}</code>. Leave empty if HTTPS bindings reference a cert already installed manually.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">PFX import password</label>
                <Input.Password
                  size="small"
                  value={certificatePfxPassword}
                  onChange={(event) => setCertificatePfxPassword(event.target.value)}
                  placeholder="#{Sensitive.OrderApiPfxPassword}"
                  autoComplete="new-password"
                  visibilityToggle
                />
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  Optional — leave empty if the PFX has no password.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Thumbprint variable name</label>
                <Input
                  size="small"
                  value={certificateThumbprintVariableName}
                  onChange={(event) => setCertificateThumbprintVariableName(event.target.value)}
                  placeholder="OrderApiCert"
                />
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  After import, the imported cert's thumbprint is exposed at <code>$SquidVariables["&lt;name&gt;.Thumbprint"]</code>. Reference it from a binding's <strong>Certificate variable name</strong> field.
                </p>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Package Extraction"
            subtitle="Extract a pre-staged .zip / .nupkg into the web root before configuring IIS."
            fullWidth
          >
            <div className="ml-[216px] w-2/3 max-w-[760px] space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Source path on agent</label>
                <Input
                  size="small"
                  value={packageSourcePath}
                  onChange={(event) => setPackageSourcePath(event.target.value)}
                  placeholder={'C:\\Squid\\Staging\\OrderApi.1.2.3.zip'}
                />
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  Absolute path to a <code>.zip</code> or <code>.nupkg</code> already staged on the Tentacle agent (via a prior step, fileserver mount, or operator manual stage). Leave empty to skip extraction.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Extract to</label>
                <Input
                  size="small"
                  value={packageExtractTo}
                  onChange={(event) => setPackageExtractTo(event.target.value)}
                  placeholder="Defaults to the web root"
                />
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  Target directory for extraction. When empty, defaults to the configured web root.
                </p>
              </div>

              <Checkbox checked={packagePurgeBeforeExtract} onChange={(event) => setPackagePurgeBeforeExtract(event.target.checked)}>
                <span className="text-sm">Purge target directory before extract</span>
              </Checkbox>
              <p className="mb-0 mt-0 text-xs text-slate-500">
                Deletes the entire target dir before re-extracting. Use to guarantee stale files from prior deploys don't survive.
              </p>

              <Checkbox checked={packageSkipIfAlreadyInstalled} onChange={(event) => setPackageSkipIfAlreadyInstalled(event.target.checked)}>
                <span className="text-sm">Skip if already installed (use deployment journal)</span>
              </Checkbox>
              <p className="mb-0 mt-0 text-xs text-slate-500">
                Short-circuits the deploy when a prior successful deploy has the same package fingerprint + web root, based on the per-site journal at <code>%ProgramData%\Squid\IISDeploy\journal\&lt;site&gt;.json</code>.
              </p>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Error Tolerance & Diagnostics"
            subtitle="Tune how the script reacts to missing variables, malformed configs, and transform failures."
            fullWidth
          >
            <div className="ml-[216px] w-2/3 max-w-[760px] space-y-3">
              <div>
                <Checkbox checked={ignoreVariableReplacementErrors} onChange={(event) => setIgnoreVariableReplacementErrors(event.target.checked)}>
                  <span className="text-sm">Ignore Configuration Variables XML parse errors</span>
                </Checkbox>
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  When enabled, malformed <code>.config</code> files are logged and skipped instead of aborting the deploy.
                </p>
              </div>

              <div>
                <Checkbox checked={shouldFailDeploymentOnSubstitutionFails} onChange={(event) => setShouldFailDeploymentOnSubstitutionFails(event.target.checked)}>
                  <span className="text-sm">Fail deployment when Substitute in Files leaves unresolved tokens</span>
                </Checkbox>
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  When disabled (default), <code>#{'{X}'}</code> tokens without a matching Squid variable are left intact in the deployed file.
                </p>
              </div>

              <div>
                <Checkbox checked={enableDiagnosticsConfigTransformationLogging} onChange={(event) => setEnableDiagnosticsConfigTransformationLogging(event.target.checked)}>
                  <span className="text-sm">Enable per-rule XDT diagnostics logging</span>
                </Checkbox>
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  Verbose trace of every XDT rule evaluated during Configuration Transforms — useful for debugging transform mismatches.
                </p>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Application Pool Retry Tuning"
            subtitle="Tune IIS metabase mutex retry behavior for performance-tuned hosts."
            fullWidth
          >
            <div className="ml-[216px] w-2/3 max-w-[760px] space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Max retry failures</label>
                <Input
                  size="small"
                  value={maxRetryFailures}
                  onChange={(event) => setMaxRetryFailures(event.target.value.replace(/\D/g, ''))}
                  placeholder="5 (default)"
                />
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  Maximum retry count when the IIS metabase mutex is held by another process. Leave empty for the default (5).
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Sleep between retry failures (seconds)</label>
                <Input
                  size="small"
                  value={sleepBetweenRetryFailuresInSeconds}
                  onChange={(event) => setSleepBetweenRetryFailuresInSeconds(event.target.value.replace(/\D/g, ''))}
                  placeholder="Random 1–3 (default)"
                />
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  Sleep interval between mutex retry attempts. Capped at 60. Leave empty for the random 1–3 second default.
                </p>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Features" subtitle="Toggle Octopus-style feature surfaces on/off for this step." defaultOpen fullWidth>
            <div className="flex w-full flex-col items-center gap-2 py-2">
              <Button type="primary" onClick={openFeaturesModal}>
                Configure features
              </Button>
              <div className="max-w-[520px] text-center text-xs leading-relaxed text-slate-500">
                You can add or manage additional features used by this step. Each ticked feature exposes its configuration section above; unticking removes the section and drops its property values on save.
              </div>
            </div>
          </CollapsibleSection>

          <Modal
            title="Enabled Features"
            open={featuresModalOpen}
            onCancel={closeFeaturesModal}
            onOk={saveFeatures}
            okText="OK"
            cancelText="Cancel"
            width={720}
          >
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="w-[44%] py-2 pr-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Feature</th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Description</th>
                </tr>
              </thead>
              <tbody>
                {IIS_FEATURES.map((feature) => {
                  const checked = featuresDraft.has(feature.id)
                  return (
                    <tr key={feature.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 pr-4 align-top">
                        <Checkbox
                          checked={checked}
                          disabled={!feature.supported}
                          onChange={(event) => toggleFeatureDraft(feature.id, event.target.checked)}
                        >
                          <span className="text-sm text-slate-700">{feature.name}</span>
                          {!feature.supported ? (
                            <span className="ml-2 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                              Coming soon
                            </span>
                          ) : null}
                        </Checkbox>
                      </td>
                      <td className="py-3 pl-4 align-top text-sm leading-relaxed text-slate-600">
                        {feature.description}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Modal>

          <CollapsibleSection title="Conditions" subtitle="Configure when and where this step should run." defaultOpen fullWidth>
            <StepConditionsSection
              value={conditions}
              onChange={setConditions}
              projectId={projectId}
              hideRootSection
              afterRunCondition={(
                <CollapsibleSection title="Start Trigger" subtitle="Control whether this step waits for the previous step to complete, or runs in parallel with it." defaultOpen>
                  <Radio.Group
                    value={startTrigger}
                    onChange={(event) => setStartTrigger(event.target.value as StartTriggerMode)}
                    className="flex flex-col gap-2"
                  >
                    <Radio value="StartWithPrevious">
                      <span className="text-sm">Run in parallel with the previous step</span>
                    </Radio>
                    <Radio value="StartAfterPrevious">
                      <span className="text-sm">Wait for all previous steps to complete, then start</span>
                    </Radio>
                  </Radio.Group>
                </CollapsibleSection>
              )}
            />
          </CollapsibleSection>
        </div>
      </div>
    )
  },
)
