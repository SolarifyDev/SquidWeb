import { useState } from 'react'
import { Alert, Button, Checkbox, Collapse, Form, Input, InputNumber, Radio, Select, Space, type FormInstance } from 'antd'
import { CheckCircleFilled, CloseCircleFilled, InfoCircleFilled } from '@ant-design/icons'
import { httpStatusOf, testDatabase, testRedis, type SetupStatus } from './api'
import { composeNpgsqlConnectionString } from './connectionString'
import { isDatabaseReady, type DatabaseTestSnapshot, type RedisTestSnapshot, type SetupFormValues } from './setupForm'

export const ADVANCED_PANEL_KEY = 'advanced'

interface DatabaseStepProps {
  form: FormInstance<SetupFormValues>
  status: SetupStatus
  token: string
  dbTest: DatabaseTestSnapshot | null
  onDbTested: (snapshot: DatabaseTestSnapshot | null) => void
  redisTest: RedisTestSnapshot | null
  onRedisTested: (snapshot: RedisTestSnapshot | null) => void
  onUnauthorized: () => void
  advancedOpen: boolean
  onAdvancedOpenChange: (open: boolean) => void
}

const ResultLine = ({ ok, info, children }: { ok: boolean; info?: boolean; children: React.ReactNode }) => {
  const icon = info
    ? <InfoCircleFilled style={{ color: '#0d80d8' }} />
    : ok ? <CheckCircleFilled style={{ color: '#00874d' }} /> : <CloseCircleFilled style={{ color: '#ef4444' }} />

  return (
    <div className="flex items-start gap-2 text-sm text-slate-700" data-testid={ok ? 'result-ok' : 'result-fail'}>
      <span className="mt-0.5">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

function databaseLine(snapshot: DatabaseTestSnapshot, createIfMissing: boolean) {
  const { result } = snapshot

  if (result.databaseExists) return <ResultLine ok>Database exists.</ResultLine>
  if (!result.canCreateDatabase) return <ResultLine ok={false}>Database does not exist, and this user is not allowed to create it.</ResultLine>
  if (!createIfMissing) return <ResultLine ok={false}>Database does not exist. Enable &quot;Create the database if it does not exist&quot; or create it manually.</ResultLine>

  return <ResultLine ok info>Database does not exist — it will be created during installation.</ResultLine>
}

const DatabaseTestResultView = ({ snapshot, createIfMissing, stale }: { snapshot: DatabaseTestSnapshot; createIfMissing: boolean; stale: boolean }) => {
  const { result } = snapshot

  return (
    <div className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5" data-testid="db-test-result">
      {result.success
        ? <ResultLine ok>Connection OK{result.serverVersion ? ` — PostgreSQL ${result.serverVersion}` : ''}.</ResultLine>
        : <ResultLine ok={false}>Connection failed{result.message ? `: ${result.message}` : '.'}</ResultLine>}
      {result.success && databaseLine(snapshot, createIfMissing)}
      {result.success && result.message && !isDatabaseReady(result, createIfMissing) && <div className="text-xs text-slate-500">{result.message}</div>}
      {stale && <div className="text-xs text-amber-700">The connection string changed since this test — test the connection again.</div>}
    </div>
  )
}

const PostgresFieldsHelper = ({ form }: { form: FormInstance<SetupFormValues> }) => {
  const fill = () => {
    const values = form.getFieldsValue(['pgHost', 'pgPort', 'pgDatabase', 'pgUsername', 'pgPassword', 'pgSslMode'])
    const connectionString = composeNpgsqlConnectionString({ host: values.pgHost, port: values.pgPort, database: values.pgDatabase, username: values.pgUsername, password: values.pgPassword, sslMode: values.pgSslMode })
    form.setFieldValue('dbConnectionString', connectionString)
    form.validateFields(['dbConnectionString']).catch(() => {})
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
      <Form.Item label="Host" name="pgHost"><Input placeholder="postgres.example.com" /></Form.Item>
      <Form.Item label="Port" name="pgPort"><InputNumber min={1} max={65535} className="w-full" /></Form.Item>
      <Form.Item label="Database" name="pgDatabase"><Input /></Form.Item>
      <Form.Item label="Username" name="pgUsername"><Input autoComplete="off" /></Form.Item>
      <Form.Item label="Password" name="pgPassword"><Input.Password autoComplete="new-password" /></Form.Item>
      <Form.Item label="SSL mode" name="pgSslMode">
        <Select options={[{ value: 'Disable', label: 'Disable' }, { value: 'Prefer', label: 'Prefer' }, { value: 'Require', label: 'Require' }]} />
      </Form.Item>
      <div className="sm:col-span-2">
        <Button onClick={fill}>Fill connection string</Button>
      </div>
    </div>
  )
}

const RedisSettings = ({ status, token, onUnauthorized, redisTest, onRedisTested }: Pick<DatabaseStepProps, 'status' | 'token' | 'onUnauthorized' | 'redisTest' | 'onRedisTested'>) => {
  const form = Form.useFormInstance<SetupFormValues>()
  const redisMode = Form.useWatch('redisMode', form)
  const connectionString = Form.useWatch('redisConnectionString', form)
  const [testing, setTesting] = useState(false)
  const builtinUnavailable = status.builtinRedisAvailable === false

  const runTest = async () => {
    const tested = (form.getFieldValue('redisConnectionString') ?? '').trim()

    if (!tested) {
      form.validateFields(['redisConnectionString']).catch(() => {})
      return
    }

    setTesting(true)
    onRedisTested(null)
    try {
      onRedisTested({ connectionString: tested, result: await testRedis(token, { connectionString: tested }) })
    } catch (error) {
      if (httpStatusOf(error) === 401) onUnauthorized()
      else onRedisTested({ connectionString: tested, result: { success: false, message: (error as Error)?.message || 'Request failed' } })
    } finally {
      setTesting(false)
    }
  }

  const stale = Boolean(redisTest && redisTest.connectionString !== (connectionString ?? '').trim())

  return (
    <>
      {builtinUnavailable && (
        <Alert type="warning" showIcon className="mb-4" data-testid="redis-builtin-unavailable" message="Built-in Redis is not available in this image. Configure an external Redis server and test the connection." />
      )}
      <Form.Item label="Redis" name="redisMode">
        <Radio.Group>
          <Space direction="vertical">
            <Radio value="Builtin" disabled={builtinUnavailable}>
              Built-in Redis{builtinUnavailable ? ' (not available in this image)' : ''}
            </Radio>
            <Radio value="External">External Redis</Radio>
          </Space>
        </Radio.Group>
      </Form.Item>
      {redisMode === 'External' && (
        <>
          <Form.Item label="Redis connection string" name="redisConnectionString" rules={[{ required: true, whitespace: true, message: 'Enter the Redis connection string' }]} extra="StackExchange.Redis format, e.g. redis:6379,password=xxx">
            <Input placeholder="redis:6379,password=xxx" />
          </Form.Item>
          <Button onClick={runTest} loading={testing}>Test Redis connection</Button>
          {redisTest && (
            <div className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5" data-testid="redis-test-result">
              <ResultLine ok={redisTest.result.success}>{redisTest.result.success ? 'Redis connection OK.' : `Redis connection failed${redisTest.result.message ? `: ${redisTest.result.message}` : '.'}`}</ResultLine>
              {stale && <div className="text-xs text-amber-700">The connection string changed since this test — test the connection again.</div>}
            </div>
          )}
        </>
      )}
    </>
  )
}

const DatabaseStep = ({ form, status, token, dbTest, onDbTested, redisTest, onRedisTested, onUnauthorized, advancedOpen, onAdvancedOpenChange }: DatabaseStepProps) => {
  const dbMode = Form.useWatch('dbMode', form)
  const connectionString = Form.useWatch('dbConnectionString', form)
  const createIfMissing = Form.useWatch('dbCreateIfMissing', form) ?? true
  const [testing, setTesting] = useState(false)

  const runTest = async () => {
    const mode = form.getFieldValue('dbMode')
    const tested = mode === 'External' ? (form.getFieldValue('dbConnectionString') ?? '').trim() : ''

    if (mode === 'External' && !tested) {
      form.validateFields(['dbConnectionString']).catch(() => {})
      return
    }

    setTesting(true)
    onDbTested(null)
    try {
      const result = await testDatabase(token, { mode, connectionString: tested })
      onDbTested({ mode, connectionString: tested, result })
    } catch (error) {
      if (httpStatusOf(error) === 401) onUnauthorized()
      else onDbTested({ mode, connectionString: tested, result: { success: false, serverVersion: null, databaseExists: false, canCreateDatabase: false, message: (error as Error)?.message || 'Request failed' } })
    } finally {
      setTesting(false)
    }
  }

  const visibleTest = dbTest && dbTest.mode === dbMode ? dbTest : null
  const stale = Boolean(visibleTest && dbMode === 'External' && visibleTest.connectionString !== (connectionString ?? '').trim())

  return (
    <>
      <Alert
        type="info"
        showIcon
        className="mb-4"
        message="Built-in PostgreSQL is recommended for evaluation and single-node installs. For production or multiple replicas, use an external PostgreSQL server."
      />

      <Form.Item label="Database" name="dbMode">
        <Radio.Group>
          <Space direction="vertical">
            <Radio value="Builtin" disabled={status.builtinDatabaseAvailable === false}>
              Built-in PostgreSQL (quick start; data stored in the /data volume)
              {status.builtinDatabaseAvailable === false && <div className="text-xs text-slate-500">Not available: this server was started without the built-in database.</div>}
            </Radio>
            <Radio value="External">External PostgreSQL</Radio>
          </Space>
        </Radio.Group>
      </Form.Item>

      {dbMode === 'External' && (
        <>
          <Form.Item label="Connection string" name="dbConnectionString" rules={[{ required: true, whitespace: true, message: 'Enter the PostgreSQL connection string' }]}>
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} placeholder="Host=postgres;Port=5432;Database=squid;Username=squid;Password=..." />
          </Form.Item>
          <Collapse
            className="mb-4"
            size="small"
            items={[{ key: 'fields', label: 'Fill by fields', forceRender: true, children: <PostgresFieldsHelper form={form} /> }]}
          />
          <Form.Item name="dbCreateIfMissing" valuePropName="checked">
            <Checkbox>Create the database if it does not exist</Checkbox>
          </Form.Item>
        </>
      )}

      <Button onClick={runTest} loading={testing}>Test connection</Button>
      {visibleTest && <DatabaseTestResultView snapshot={visibleTest} createIfMissing={createIfMissing} stale={stale} />}

      <Collapse
        className="mt-6"
        activeKey={advancedOpen ? [ADVANCED_PANEL_KEY] : []}
        onChange={(keys) => onAdvancedOpenChange((Array.isArray(keys) ? keys : [keys]).includes(ADVANCED_PANEL_KEY))}
        items={[{ key: ADVANCED_PANEL_KEY, label: 'Advanced', forceRender: true, children: <RedisSettings status={status} token={token} onUnauthorized={onUnauthorized} redisTest={redisTest} onRedisTested={onRedisTested} /> }]}
      />
    </>
  )
}

export default DatabaseStep
