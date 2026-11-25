import { useMemo, useRef, useState } from 'react'
import { Alert, Button, Input, Modal, Select } from 'antd'
import ProviderForm from 'components/providerForm/ProviderForm'
import {
  buildInitialValue,
  buildSubmission,
  effectiveSecretHasValue,
  validateProviderForm,
  type ProviderFormErrors,
  type ProviderFormValue,
} from 'components/providerForm/providerFormValues'
import {
  createPackageStore,
  testPackageStoreSettings,
  updatePackageStore,
  type PackageStoreDto,
  type PackageStoreProviderDescriptor,
  type PackageStoreTestResult,
} from 'pages/apis/packageStore'
import { findProvider } from './storeDisplay'

interface PackageStoreDialogProps {
  providers: PackageStoreProviderDescriptor[]
  /** The store being edited; leave out to add a new one. */
  store?: PackageStoreDto
  onClose: () => void
  /** Called after the server accepted a save so the list can reload. */
  onChanged: () => void
}

const NAME_ERROR_KEY = '__name'
export const PROVIDER_UNAVAILABLE_MESSAGE = "This storage type isn't available in this version"

function errorMessage(error: unknown, fallback: string) {
  return (error as { message?: string })?.message || fallback
}

/** An existing store keeps its own kind even when this version no longer knows it; only a new store defaults to the first provider. */
function pickInitialProvider(providers: PackageStoreProviderDescriptor[], store?: PackageStoreDto) {
  return store ? findProvider(store, providers) : providers[0]
}

function TestResultAlert({ result }: { result: PackageStoreTestResult }) {
  return (
    <>
      <Alert className="mb-2" type={result.success ? 'success' : 'error'} showIcon message={result.message} />
      {(result.warnings ?? []).map((warning) => (
        <Alert key={warning} className="mb-2" type="warning" showIcon message={warning} />
      ))}
    </>
  )
}

export default function PackageStoreDialog({ providers, store, onClose, onChanged }: PackageStoreDialogProps) {
  const isEdit = store != null
  const [kind, setKind] = useState(() => (store ? store.kind : providers[0]?.kind))
  const provider = useMemo(() => providers.find((item) => item.kind === kind), [providers, kind])
  const providerMissing = isEdit && provider == null
  const initial = useRef(buildInitialValue(pickInitialProvider(providers, store)?.fields ?? [], store?.properties))
  const [name, setName] = useState(store?.name ?? '')
  const [value, setValue] = useState<ProviderFormValue>(initial.current)
  const [errors, setErrors] = useState<ProviderFormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<PackageStoreTestResult | null>(null)
  const [busy, setBusy] = useState(false)

  const fields = provider?.fields ?? []
  const secretHasValue = effectiveSecretHasValue(fields, store?.secretHasValue ?? {}, initial.current.properties, value)

  const clearOutcome = () => {
    setTestResult(null)
    setServerError(null)
  }

  const changeName = (next: string) => {
    clearOutcome()
    setName(next)
  }

  const changeValue = (next: ProviderFormValue) => {
    clearOutcome()
    setValue(next)
  }

  const changeKind = (nextKind: string) => {
    clearOutcome()
    setKind(nextKind)
    setValue(buildInitialValue(providers.find((item) => item.kind === nextKind)?.fields ?? []))
    setErrors({})
  }

  const validate = () => {
    const found = validateProviderForm(fields, value, secretHasValue)
    if (!name.trim()) found[NAME_ERROR_KEY] = 'Name is required'
    setErrors(found)
    return Object.keys(found).length === 0
  }

  const save = async () => {
    clearOutcome()
    if (!provider || !validate()) return

    const { properties, secrets } = buildSubmission(fields, value)
    setBusy(true)
    try {
      if (store) await updatePackageStore({ id: store.id, name: name.trim(), properties, secrets })
      else await createPackageStore({ kind: provider.kind, name: name.trim(), properties, secrets })
      onChanged()
      onClose()
    } catch (error) {
      setServerError(errorMessage(error, 'Failed to save the package store.'))
    } finally {
      setBusy(false)
    }
  }

  const runTest = async () => {
    clearOutcome()
    if (!provider || !validate()) return

    const { properties, secrets } = buildSubmission(fields, value)
    setBusy(true)
    try {
      setTestResult(await testPackageStoreSettings({ kind: provider.kind, properties, secrets, storeId: store?.id }))
    } catch (error) {
      setServerError(errorMessage(error, 'Failed to test the package store.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={isEdit ? `Edit ${store.name}` : 'Add package store'}
      onCancel={onClose}
      closable={!busy}
      keyboard={!busy}
      maskClosable={false}
      destroyOnClose
      footer={[
        <Button key="test" onClick={runTest} disabled={busy || providerMissing} title="Tests the values in this form without saving">
          Test
        </Button>,
        <Button key="cancel" onClick={onClose} disabled={busy}>
          Cancel
        </Button>,
        <Button key="save" type="primary" onClick={save} loading={busy} disabled={providerMissing}>
          Save
        </Button>,
      ]}
    >
      {providerMissing ? <Alert className="mb-4" type="warning" showIcon message={PROVIDER_UNAVAILABLE_MESSAGE} /> : null}

      <div className="mb-4">
        <label htmlFor="package-store-name" className="mb-1 block text-sm font-medium text-slate-700">
          Name<span className="ml-0.5 text-red-500">*</span>
        </label>
        <Input id="package-store-name" value={name} disabled={busy || providerMissing} status={errors[NAME_ERROR_KEY] ? 'error' : undefined} onChange={(event) => changeName(event.target.value)} />
        {errors[NAME_ERROR_KEY] ? <div role="alert" className="mt-1 text-xs text-red-600">{errors[NAME_ERROR_KEY]}</div> : null}
      </div>

      <div className="mb-4">
        <label htmlFor="package-store-kind" className="mb-1 block text-sm font-medium text-slate-700">Type</label>
        <Select
          id="package-store-kind"
          className="w-full"
          value={kind}
          disabled={isEdit || busy}
          options={providers.map((item) => ({ value: item.kind, label: item.displayName }))}
          onChange={changeKind}
        />
        {provider?.description ? <div className="mt-1 text-xs text-slate-500">{provider.description}</div> : null}
      </div>

      <ProviderForm fields={fields} value={value} onChange={changeValue} secretHasValue={secretHasValue} errors={errors} disabled={busy || providerMissing} />

      {testResult ? <TestResultAlert result={testResult} /> : null}
      {serverError ? <Alert className="mb-2" type="error" showIcon message={serverError} /> : null}
    </Modal>
  )
}
