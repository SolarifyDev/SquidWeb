import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Descriptions, Form, Input, Modal, Steps } from 'antd'
import { getPackageStorageProviders, httpStatusOf, responseBodyOf, startInstall, type InstallValidationError, type SetupStatus } from './api'
import { validateProviderForm, type ProviderFormErrors } from 'components/providerForm/providerFormValues'
import type { PackageStoreProviderDescriptor } from 'pages/apis/packageStore'
import { maskConnectionString } from './connectionString'
import DatabaseStep from './DatabaseStep'
import PackageStorageStep, { type PackageStorageTestSnapshot } from './PackageStorageStep'
import { buildPackageStorageSection, DEFAULT_PACKAGE_STORAGE, descriptorOf, summarizePackageStorage, type PackageStorageSelection } from './packageStorageForm'
import SetupProgressView, { DEFAULT_POLL_TIMINGS, type PollTimings } from './SetupProgressView'
import { buildInstallRequest, canLeaveDatabaseStep, canLeaveRedisSettings, fieldLabel, isFieldRendered, isHttpUrl, isPackageStorageError, mapServerErrors, PACKAGE_STORAGE_STEP, STEP_FIELDS, type DatabaseTestSnapshot, type RedisTestSnapshot, type SetupFormValues } from './setupForm'

const MIN_PASSWORD_LENGTH = 8
const DEFAULT_POLLING_PORT = 10943
const STEP_TITLES = ['Database', 'Administrator', 'Server URLs', 'Package storage', 'Review & Install']
const REVIEW_STEP = STEP_TITLES.length - 1

interface SetupWizardProps {
  status: SetupStatus
  onFinished: () => void
  timings?: PollTimings
}

function initialValues(status: SetupStatus): SetupFormValues {
  return {
    dbMode: status.builtinDatabaseAvailable === false ? 'External' : 'Builtin',
    dbCreateIfMissing: true,
    pgPort: 5432,
    pgDatabase: 'squid',
    pgSslMode: 'Prefer',
    redisMode: status.builtinRedisAvailable === false ? 'External' : 'Builtin',
    adminUserName: 'admin',
    adminPassword: '',
    adminConfirmPassword: '',
    externalUrl: status.suggestedExternalUrl?.trim() || window.location.origin,
    commsUrl: '',
  }
}

const TOKEN_PARAM = 'token'

/** The query string without the setup token, so a rejected token cannot come back on reload. */
function searchWithoutToken(search: string) {
  const params = new URLSearchParams(search)
  params.delete(TOKEN_PARAM)
  const rest = params.toString()

  return rest ? `?${rest}` : ''
}

// Reads ?token= once, then removes it from the address bar (keeping any other query params).
function useSetupTokenFromUrl() {
  const location = useLocation()
  const navigate = useNavigate()
  const [initialToken] = useState(() => new URLSearchParams(location.search).get(TOKEN_PARAM)?.trim() ?? '')

  useEffect(() => {
    if (!new URLSearchParams(location.search).has(TOKEN_PARAM)) return
    navigate({ pathname: location.pathname, search: searchWithoutToken(location.search), hash: location.hash }, { replace: true })
  }, [location.hash, location.pathname, location.search, navigate])

  return initialToken
}

function nextBlockedReason(databaseReady: boolean, redisReady: boolean) {
  if (!databaseReady) return 'Test the database connection to continue.'
  if (!redisReady) return 'Test the Redis connection (under Advanced) to continue.'

  return null
}

const urlRule = (required: boolean) => ({
  validator: (_: unknown, value?: string) => {
    const trimmed = (value ?? '').trim()
    if (!trimmed) return required ? Promise.reject(new Error('Enter a URL')) : Promise.resolve()
    return isHttpUrl(trimmed) ? Promise.resolve() : Promise.reject(new Error('Enter an http:// or https:// URL'))
  },
})

const TokenPrompt = ({ rejected, onSubmit }: { rejected: boolean; onSubmit: (token: string) => void }) => {
  const [value, setValue] = useState('')

  return (
    <div className="space-y-4" data-testid="token-prompt">
      {rejected && <Alert type="error" showIcon message="The setup token was rejected. Check it and enter it again." />}
      <p className="m-0 text-sm text-slate-600">
        Enter the setup token. It is printed in the container logs (<code>docker logs &lt;container&gt;</code>), or run <code>cat /data/setup-token</code> inside the container.
      </p>
      <Input.Password aria-label="Setup token" placeholder="Setup token" value={value} onChange={(e) => setValue(e.target.value)} onPressEnter={() => value.trim() && onSubmit(value.trim())} />
      <Button type="primary" disabled={!value.trim()} onClick={() => onSubmit(value.trim())}>Continue</Button>
    </div>
  )
}

const ReviewSummary = ({ values, pollingPort, providers, selection }: { values: SetupFormValues; pollingPort: number; providers: PackageStoreProviderDescriptor[] | null; selection: PackageStorageSelection }) => {
  const request = buildInstallRequest(values)
  const storage = summarizePackageStorage(providers, selection)

  return (
    <Descriptions column={1} size="small" bordered>
      <Descriptions.Item label="Database">
        {request.database.mode === 'Builtin' ? 'Built-in PostgreSQL' : <>External PostgreSQL<div className="break-all text-xs text-slate-500">{maskConnectionString(request.database.connectionString, 'postgres')}</div></>}
      </Descriptions.Item>
      {request.database.mode === 'External' && <Descriptions.Item label="Create database if missing">{request.database.createIfMissing ? 'Yes' : 'No'}</Descriptions.Item>}
      <Descriptions.Item label="Redis">
        {request.redis.mode === 'Builtin' ? 'Built-in Redis' : <>External Redis<div className="break-all text-xs text-slate-500">{maskConnectionString(request.redis.connectionString, 'redis')}</div></>}
      </Descriptions.Item>
      <Descriptions.Item label="Administrator">{request.admin.userName}</Descriptions.Item>
      <Descriptions.Item label="External URL">{request.server.externalUrl}</Descriptions.Item>
      <Descriptions.Item label="Polling URL">{request.server.commsUrl || `Derived from the external URL host + port ${pollingPort}`}</Descriptions.Item>
      <Descriptions.Item label="Package storage">
        <div data-testid="review-package-storage">{storage.title}
        {storage.details.map((line) => <div key={line} className="break-all text-xs text-slate-500">{line}</div>)}</div>
      </Descriptions.Item>
    </Descriptions>
  )
}

const SetupWizard = ({ status, onFinished, timings = DEFAULT_POLL_TIMINGS }: SetupWizardProps) => {
  const [form] = Form.useForm<SetupFormValues>()
  const initial = useMemo(() => initialValues(status), [status])
  const pollingPort = status.defaultPollingPort || DEFAULT_POLLING_PORT

  const urlToken = useSetupTokenFromUrl()
  const [token, setToken] = useState(urlToken)
  const [tokenRejected, setTokenRejected] = useState(false)
  const [current, setCurrent] = useState(0)
  const [view, setView] = useState<'form' | 'progress'>('form')
  const [dbTest, setDbTest] = useState<DatabaseTestSnapshot | null>(null)
  const [redisTest, setRedisTest] = useState<RedisTestSnapshot | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(status.builtinRedisAvailable === false)
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)
  const [providers, setProviders] = useState<PackageStoreProviderDescriptor[] | null>(null)
  const [providersError, setProvidersError] = useState<string | null>(null)
  const [providersAttempt, setProvidersAttempt] = useState(0)
  const [packageStorage, setPackageStorage] = useState<PackageStorageSelection>(DEFAULT_PACKAGE_STORAGE)
  const [packageErrors, setPackageErrors] = useState<ProviderFormErrors>({})
  const [packageTest, setPackageTest] = useState<PackageStorageTestSnapshot | null>(null)

  const dbMode = Form.useWatch('dbMode', form) ?? initial.dbMode
  const dbConnectionString = Form.useWatch('dbConnectionString', form)
  const dbCreateIfMissing = Form.useWatch('dbCreateIfMissing', form) ?? initial.dbCreateIfMissing
  const redisMode = Form.useWatch('redisMode', form) ?? initial.redisMode
  const redisConnectionString = Form.useWatch('redisConnectionString', form)
  const adminUserName = Form.useWatch('adminUserName', form) ?? initial.adminUserName
  const blockedReason = nextBlockedReason(canLeaveDatabaseStep(dbMode, dbConnectionString, dbCreateIfMissing, dbTest), canLeaveRedisSettings(redisMode, redisConnectionString, redisTest))

  const handleUnauthorized = useCallback(() => {
    setToken('')
    setTokenRejected(true)
    setInstalling(false)
  }, [])

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false

    getPackageStorageProviders(token).then(
      (loaded) => { if (!cancelled) { setProviders(loaded); setProvidersError(null) } },
      (error) => {
        if (cancelled) return
        if (httpStatusOf(error) === 401) handleUnauthorized()
        else setProvidersError((error as Error)?.message || 'The storage options could not be loaded.')
      },
    )

    return () => { cancelled = true }
  }, [token, providersAttempt, handleUnauthorized])

  const retryProviders = () => {
    setProvidersError(null)
    setProvidersAttempt((attempt) => attempt + 1)
  }

  const validatePackageStorage = () => {
    const fields = descriptorOf(providers, packageStorage.kind)?.fields ?? []
    const errors = validateProviderForm(fields, packageStorage.value)

    setPackageErrors(errors)

    return Object.keys(errors).length === 0
  }

  const changePackageStorage = (next: PackageStorageSelection) => {
    setPackageStorage(next)
    setPackageErrors({})
  }

  const submitToken = (next: string) => {
    setToken(next)
    setTokenRejected(false)
  }

  const goNext = async () => {
    try {
      await form.validateFields(STEP_FIELDS[current])
    } catch {
      if (current === 0 && form.getFieldError('redisConnectionString').length > 0) setAdvancedOpen(true)
      return
    }
    if (current === PACKAGE_STORAGE_STEP && !validatePackageStorage()) return
    setCurrent(current + 1)
  }

  // Errors for fields that are not rendered (e.g. the connection string while Built-in is selected)
  // would be invisible on the field, so they are listed in the error alert instead.
  const applyValidationErrors = (body: InstallValidationError | undefined) => {
    const { fieldErrors, unmatched } = mapServerErrors(body?.errors)
    const values = form.getFieldsValue(true) as SetupFormValues
    const onField = fieldErrors.filter((error) => isFieldRendered(error.field, values))
    const listed = fieldErrors.filter((error) => !isFieldRendered(error.field, values)).map((error) => `${fieldLabel(error.field)}: ${error.message}`)

    form.setFields(onField.map((error) => ({ name: error.field, errors: [error.message] })))
    if (fieldErrors.some((error) => error.field.startsWith('redis'))) setAdvancedOpen(true)
    const failedSteps = fieldErrors.map((error) => error.step)
    if (Object.keys(body?.errors ?? {}).some(isPackageStorageError)) failedSteps.push(PACKAGE_STORAGE_STEP)
    if (failedSteps.length > 0) setCurrent(Math.min(...failedSteps))

    setInstallError([body?.message || 'The server rejected the configuration.', ...listed, ...unmatched].join('\n'))
  }

  const install = async () => {
    setInstalling(true)
    setInstallError(null)
    try {
      await startInstall(token, buildInstallRequest(form.getFieldsValue(true) as SetupFormValues, buildPackageStorageSection(providers, packageStorage)))
      setView('progress')
    } catch (error) {
      const httpStatus = httpStatusOf(error)
      if (httpStatus === 409) setView('progress')
      else if (httpStatus === 401) handleUnauthorized()
      else if (httpStatus === 400) applyValidationErrors(responseBodyOf<InstallValidationError>(error))
      else setInstallError((error as Error)?.message || 'Installation request failed.')
    } finally {
      setInstalling(false)
    }
  }

  const backToEdit = () => {
    setView('form')
    setCurrent(0)
  }

  return (
    <div className="min-h-screen w-full flex justify-center p-6 sm:p-10" style={{ background: 'radial-gradient(circle at 12% 10%, #f7fbff 0%, #eef3f9 38%, #e8edf4 100%)' }}>
      <div className="w-full max-w-[760px]">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white shadow-sm border border-slate-200 flex items-center justify-center">
            <img src="/squid-logo.png" alt="Squid" className="h-7 w-7 object-contain" />
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-[0.12em]">Squid Deploy</div>
            <div className="text-sm font-semibold text-slate-800">First-run setup</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.08)] p-6 sm:p-7">
          <div className="mb-6">
            <h2 className="m-0 text-2xl font-semibold text-slate-900">Set up Squid</h2>
            <p className="mt-2 mb-0 text-sm text-slate-500">Choose where Squid stores its data, create the administrator, and confirm the server address.</p>
          </div>

          {status.dataVolumeWarning?.trim() && <Alert type="warning" showIcon className="mb-6" data-testid="data-volume-warning" message={status.dataVolumeWarning} />}

          <Modal title="Setup token required" open={!token} closable={false} maskClosable={false} keyboard={false} footer={null} destroyOnHidden>
            <TokenPrompt rejected={tokenRejected} onSubmit={submitToken} />
          </Modal>

          {view === 'progress' && (
            <SetupProgressView token={token} adminUserName={adminUserName} timings={timings} onBackToEdit={backToEdit} onFinished={onFinished} onUnauthorized={handleUnauthorized} />
          )}

          <div hidden={view !== 'form'}>
            <Steps className="mb-6" size="small" current={current} items={STEP_TITLES.map((title) => ({ title }))} />

            <Form form={form} layout="vertical" initialValues={initial} requiredMark={false}>
              <div hidden={current !== 0}>
                <DatabaseStep form={form} status={status} token={token} dbTest={dbTest} onDbTested={setDbTest} redisTest={redisTest} onRedisTested={setRedisTest} onUnauthorized={handleUnauthorized} advancedOpen={advancedOpen} onAdvancedOpenChange={setAdvancedOpen} />
              </div>

              <div hidden={current !== 1}>
                <Form.Item label="Username" name="adminUserName" rules={[{ required: true, whitespace: true, message: 'Enter a username' }]}>
                  <Input autoComplete="username" />
                </Form.Item>
                <Form.Item label="Password" name="adminPassword" rules={[{ required: true, message: 'Enter a password' }, { min: MIN_PASSWORD_LENGTH, message: `Use at least ${MIN_PASSWORD_LENGTH} characters` }]}>
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
                <Form.Item
                  label="Confirm password"
                  name="adminConfirmPassword"
                  dependencies={['adminPassword']}
                  rules={[
                    { required: true, message: 'Confirm the password' },
                    ({ getFieldValue }) => ({
                      validator: (_, value) => (!value || value === getFieldValue('adminPassword') ? Promise.resolve() : Promise.reject(new Error('Passwords do not match'))),
                    }),
                  ]}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
              </div>

              <div hidden={current !== 2}>
                <Form.Item label="External URL" name="externalUrl" rules={[urlRule(true)]} extra="The address people use to open Squid in a browser.">
                  <Input placeholder="https://squid.example.com" />
                </Form.Item>
                <Form.Item
                  label="Polling URL (optional)"
                  name="commsUrl"
                  rules={[urlRule(false)]}
                  extra={`Address Tentacles/agents use to poll the server. Leave empty to derive it from the external URL host + port ${pollingPort}.`}
                >
                  <Input placeholder={`https://<host>:${pollingPort}`} />
                </Form.Item>
              </div>

              {current === REVIEW_STEP && <ReviewSummary values={form.getFieldsValue(true) as SetupFormValues} pollingPort={pollingPort} providers={providers} selection={packageStorage} />}
            </Form>

            <div hidden={current !== PACKAGE_STORAGE_STEP}>
              <PackageStorageStep token={token} providers={providers} loadError={providersError} onRetryLoad={retryProviders} selection={packageStorage} onSelectionChange={changePackageStorage} errors={packageErrors} validate={validatePackageStorage} test={packageTest} onTested={setPackageTest} onUnauthorized={handleUnauthorized} />
            </div>

            {installError && <Alert type="error" showIcon className="mt-4 whitespace-pre-line" message={installError} />}

            <div className="mt-6 flex items-center justify-between gap-3">
              <Button disabled={current === 0 || installing} onClick={() => setCurrent(current - 1)}>Back</Button>
              {current === 0 && blockedReason && <span className="text-xs text-slate-500" data-testid="next-blocked-reason">{blockedReason}</span>}
              {current < REVIEW_STEP
                ? <Button type="primary" disabled={current === 0 && blockedReason !== null} onClick={goNext}>Next</Button>
                : <Button type="primary" loading={installing} onClick={install}>Install</Button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SetupWizard
