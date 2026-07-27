import React from 'react'
import { Checkbox, Input } from 'antd'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import { DEFAULT_CONFIGURATION_TRANSFORMS_ENVIRONMENT_NAME } from '../deploy-package-model'

interface ConfigurationRewriteSectionsProps {
  configurationVariablesEnabled: boolean
  configurationTransformsEnabled: boolean
  configurationTransformsEnvironmentName: string
  additionalTransforms: string
  substituteInFilesEnabled: boolean
  substituteInFilesTargetFiles: string
  substituteFailOnUnresolved: boolean
  structuredConfigEnabled: boolean
  structuredConfigTargets: string
  onConfigurationVariablesEnabledChange: (value: boolean) => void
  onConfigurationTransformsEnabledChange: (value: boolean) => void
  onConfigurationTransformsEnvironmentNameChange: (value: string) => void
  onAdditionalTransformsChange: (value: string) => void
  onSubstituteInFilesEnabledChange: (value: boolean) => void
  onSubstituteInFilesTargetFilesChange: (value: string) => void
  onSubstituteFailOnUnresolvedChange: (value: boolean) => void
  onStructuredConfigEnabledChange: (value: boolean) => void
  onStructuredConfigTargetsChange: (value: string) => void
}

export function ConfigurationRewriteSections({
  configurationVariablesEnabled,
  configurationTransformsEnabled,
  configurationTransformsEnvironmentName,
  additionalTransforms,
  substituteInFilesEnabled,
  substituteInFilesTargetFiles,
  substituteFailOnUnresolved,
  structuredConfigEnabled,
  structuredConfigTargets,
  onConfigurationVariablesEnabledChange,
  onConfigurationTransformsEnabledChange,
  onConfigurationTransformsEnvironmentNameChange,
  onAdditionalTransformsChange,
  onSubstituteInFilesEnabledChange,
  onSubstituteInFilesTargetFilesChange,
  onSubstituteFailOnUnresolvedChange,
  onStructuredConfigEnabledChange,
  onStructuredConfigTargetsChange,
}: ConfigurationRewriteSectionsProps) {
  return (
    <>
      <CollapsibleSection
        title=".NET Configuration Variables"
        subtitle="If set, replace appSettings and connectionString entries in any .config files."
        defaultOpen
      >
        <Checkbox
          checked={configurationVariablesEnabled}
          onChange={(event) => onConfigurationVariablesEnabledChange(event.target.checked)}
        >
          <span className="text-sm">Replace entries in .config files</span>
        </Checkbox>
        <p className="mb-0 mt-1 text-xs text-slate-500">
          Squid will scan <code>.config</code> files and replace matching keys using step variables.
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        title=".NET Configuration Transforms"
        subtitle="Configure .NET XML configuration transforms."
        defaultOpen
        fullWidth
      >
        <div className="ml-[216px] w-2/3 max-w-[760px] space-y-4">
          <Checkbox
            checked={configurationTransformsEnabled}
            onChange={(event) => onConfigurationTransformsEnabledChange(event.target.checked)}
          >
            <span className="text-sm">Apply configuration transforms</span>
          </Checkbox>

          {configurationTransformsEnabled ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Environment transform name</label>
              <Input
                value={configurationTransformsEnvironmentName}
                onChange={(event) => onConfigurationTransformsEnvironmentNameChange(event.target.value)}
                placeholder={DEFAULT_CONFIGURATION_TRANSFORMS_ENVIRONMENT_NAME}
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
              onChange={(event) => onAdditionalTransformsChange(event.target.value)}
              autoSize={{ minRows: 3, maxRows: 8 }}
              placeholder="Web.Release.config => Web.config"
            />
            <div className="mt-2 space-y-2 text-xs leading-relaxed text-slate-500">
              <p className="mb-0">A comma- or newline-separated list of additional configuration transformation file rules. Example:</p>
              <pre className="mb-0 whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-600">
                {
                  'Web.Release.config => Web.config\n*.Foo.config => *.config\ncrossdomainpolicy.#{Squid.Environment.Name}.xml => crossdomainpolicy.xml'
                }
              </pre>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Substitute Variables in Files"
        subtitle="Replace #{Variable} tokens inside any text file (JSON / YAML / properties / .config / .txt)."
        defaultOpen
        fullWidth
      >
        <div className="ml-[216px] w-2/3 max-w-[760px] space-y-4">
          <Checkbox
            checked={substituteInFilesEnabled}
            onChange={(event) => onSubstituteInFilesEnabledChange(event.target.checked)}
          >
            <span className="text-sm">Enable variable token replacement in files</span>
          </Checkbox>

          {substituteInFilesEnabled ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Target files</label>
                <Input.TextArea
                  value={substituteInFilesTargetFiles}
                  onChange={(event) => onSubstituteInFilesTargetFilesChange(event.target.value)}
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  placeholder={'appsettings.json\nappsettings.#{Squid.Environment.Name}.json\n*.yml'}
                />
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  Newline-separated globs relative to the installation directory (or absolute paths). Every{' '}
                  <code>#{'{VariableName}'}</code> token is replaced with the matching Squid variable.
                </p>
              </div>
              <Checkbox
                checked={substituteFailOnUnresolved}
                onChange={(event) => onSubstituteFailOnUnresolvedChange(event.target.checked)}
              >
                <span className="text-sm">Fail deployment if any tokens cannot be resolved</span>
              </Checkbox>
            </>
          ) : null}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Structured Configuration Variables"
        subtitle="Replace JSON leaves where the path matches a Squid variable (e.g. Logging:LogLevel:Default)."
        defaultOpen
        fullWidth
      >
        <div className="ml-[216px] w-2/3 max-w-[760px] space-y-4">
          <Checkbox
            checked={structuredConfigEnabled}
            onChange={(event) => onStructuredConfigEnabledChange(event.target.checked)}
          >
            <span className="text-sm">Enable JSON leaf replacement</span>
          </Checkbox>

          {structuredConfigEnabled ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Target files</label>
              <Input.TextArea
                value={structuredConfigTargets}
                onChange={(event) => onStructuredConfigTargetsChange(event.target.value)}
                autoSize={{ minRows: 3, maxRows: 8 }}
                placeholder={'appsettings.json\nappsettings.Production.json'}
              />
              <p className="mb-0 mt-1 text-xs text-slate-500">
                Newline-separated globs relative to the installation directory. Path forms{' '}
                <code>Logging.LogLevel.Default</code> and <code>Logging:LogLevel:Default</code> are both supported.
              </p>
            </div>
          ) : null}
        </div>
      </CollapsibleSection>
    </>
  )
}
