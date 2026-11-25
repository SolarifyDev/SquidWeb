import { useState } from 'react'
import { Alert, Button, Radio, Spin } from 'antd'
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons'
import ProviderForm from 'components/providerForm/ProviderForm'
import type { ProviderFormErrors } from 'components/providerForm/providerFormValues'
import type { PackageStoreProviderDescriptor } from 'pages/apis/packageStore'
import { httpStatusOf, testPackageStorage, type PackageStorageChoice, type PackageStorageTestResult } from './api'
import { descriptorOf, selectionFor, submissionOf, type PackageStorageSelection } from './packageStorageForm'

export interface PackageStorageTestSnapshot {
  choice: PackageStorageChoice
  result: PackageStorageTestResult
}

interface PackageStorageStepProps {
  token: string
  providers: PackageStoreProviderDescriptor[] | null
  loadError: string | null
  onRetryLoad: () => void
  selection: PackageStorageSelection
  onSelectionChange: (selection: PackageStorageSelection) => void
  errors: ProviderFormErrors
  /** Called with the field errors of the current selection; returns whether it is complete enough to test. */
  validate: () => boolean
  test: PackageStorageTestSnapshot | null
  onTested: (snapshot: PackageStorageTestSnapshot | null) => void
  onUnauthorized: () => void
}

const sameChoice = (a: PackageStorageChoice, b: PackageStorageChoice) => JSON.stringify(a) === JSON.stringify(b)

const TestResultView = ({ snapshot, stale }: { snapshot: PackageStorageTestSnapshot; stale: boolean }) => (
  <div className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5" data-testid="package-storage-test-result">
    <div className="flex items-start gap-2 text-sm text-slate-700">
      <span className="mt-0.5">{snapshot.result.success ? <CheckCircleFilled style={{ color: '#00874d' }} /> : <CloseCircleFilled style={{ color: '#ef4444' }} />}</span>
      <span>{snapshot.result.success ? 'Storage OK' : 'Storage check failed'}{snapshot.result.message ? `: ${snapshot.result.message}` : '.'}</span>
    </div>
    {stale && <div className="text-xs text-amber-700">The settings changed since this test — test the connection again.</div>}
  </div>
)

const PackageStorageStep = ({ token, providers, loadError, onRetryLoad, selection, onSelectionChange, errors, validate, test, onTested, onUnauthorized }: PackageStorageStepProps) => {
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const descriptor = descriptorOf(providers, selection.kind)
  const current = submissionOf(providers, selection)

  const choose = (kind: string) => {
    const next = providers?.find((provider) => provider.kind === kind)
    if (!next || kind === selection.kind) return
    onSelectionChange(selectionFor(next))
    onTested(null)
    setTestError(null)
  }

  const runTest = async () => {
    if (!validate()) return
    setTesting(true)
    setTestError(null)
    try {
      onTested({ choice: current, result: await testPackageStorage(token, current) })
    } catch (error) {
      if (httpStatusOf(error) === 401) onUnauthorized()
      else setTestError((error as Error)?.message || 'The storage check could not be run.')
    } finally {
      setTesting(false)
    }
  }

  if (loadError) {
    return (
      <Alert type="warning" showIcon message="Could not load the storage options." description={`${loadError} Next keeps the default: packages stay in the data directory of this server.`} action={<Button size="small" onClick={onRetryLoad}>Retry</Button>} />
    )
  }
  if (!providers) return <Spin />

  return (
    <div data-testid="package-storage-step">
      <p className="mt-0 mb-4 text-sm text-slate-600">Where uploaded packages are kept. The default is a folder in the data directory of this server; you can change it later in the settings.</p>

      <Radio.Group className="mb-5 grid w-full gap-3" value={selection.kind} onChange={(event) => choose(event.target.value)}>
        {providers.map((provider) => (
          <Radio key={provider.kind} value={provider.kind} className={`!m-0 w-full rounded-lg border px-4 py-3 ${provider.kind === selection.kind ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white'}`}>
            <span className="font-medium text-slate-800">{provider.displayName}</span>
            {provider.description ? <span className="block text-xs text-slate-500">{provider.description}</span> : null}
          </Radio>
        ))}
      </Radio.Group>

      {descriptor && <ProviderForm fields={descriptor.fields} value={selection.value} onChange={(value) => onSelectionChange({ ...selection, value })} errors={errors} disabled={testing} />}

      <Button loading={testing} onClick={runTest}>Test connection</Button>
      {testError && <Alert type="error" showIcon className="mt-3" message={testError} />}
      {test && <TestResultView snapshot={test} stale={!sameChoice(test.choice, current)} />}
    </div>
  )
}

export default PackageStorageStep
