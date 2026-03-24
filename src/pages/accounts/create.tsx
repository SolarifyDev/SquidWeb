import React, { useEffect, useMemo, useState } from 'react'
import { Button, Input, Radio, Select, message } from 'antd'
import { DownOutlined } from '@ant-design/icons'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useSpace } from 'contexts/SpaceContext'
import { createDeploymentAccount } from 'pages/apis/deploymentAccount'
import { getEnvironments, type EnvironmentDto } from 'pages/apis/environment'

type SectionKey =
  | 'name'
  | 'description'
  | 'username'
  | 'password'
  | 'token'
  | 'awsAuthenticationMethod'
  | 'awsAccessKey'
  | 'awsSecretKey'
  | 'environments'
type AwsAuthenticationMethod = 'AmazonWebServicesAccount' | 'AmazonWebServicesOidcAccount'

interface FormPanelProps {
  title: string
  subtitle?: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  hasBorder?: boolean
  children: React.ReactNode
}

function FormPanel({
  title,
  subtitle,
  isOpen,
  onToggle,
  hasBorder = true,
  children,
}: FormPanelProps) {
  return (
    <div className={hasBorder ? 'border-b border-gray-200' : ''}>
      <div
        className="grid items-start py-4 pl-6 pr-6 cursor-pointer select-none"
        style={{ gridTemplateColumns: '260px 1fr auto' }}
        onClick={onToggle}
      >
        <div className="text-base font-bold text-gray-900 pt-0.5">{title}</div>
        <div className="text-sm text-gray-500 pt-0.5">{subtitle}</div>
        <button
          type="button"
          aria-label={isOpen ? `Collapse ${title}` : `Expand ${title}`}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <DownOutlined className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ fontSize: 12 }} />
        </button>
      </div>
      {isOpen && (
        <div className="grid pl-6 pr-6 pb-5" style={{ gridTemplateColumns: '260px 1fr' }}>
          <div />
          <div>{children}</div>
        </div>
      )}
    </div>
  )
}

const AccountsCreatePage: React.FC = () => {
  const navigate = useNavigate()
  const { space } = useSpace()
  const [searchParams] = useSearchParams()

  const accountTypeParam = Number(searchParams.get('accountType') ?? '3')
  const accountType = Number.isFinite(accountTypeParam) ? accountTypeParam : 3
  const isTokenType = accountType === 3
  const isUsernamePasswordType = accountType === 1
  const isAwsType = accountType === 4 || accountType === 6
  const isSupportedType = isTokenType || isUsernamePasswordType || isAwsType

  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [awsAuthenticationMethod, setAwsAuthenticationMethod] = useState<AwsAuthenticationMethod>('AmazonWebServicesAccount')
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [selectedEnvironmentIds, setSelectedEnvironmentIds] = useState<number[]>([])
  const [environmentOptions, setEnvironmentOptions] = useState<EnvironmentDto[]>([])
  const [loadingEnvironmentOptions, setLoadingEnvironmentOptions] = useState(false)
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    name: true,
    description: true,
    username: true,
    password: true,
    token: true,
    awsAuthenticationMethod: true,
    awsAccessKey: true,
    awsSecretKey: true,
    environments: true,
  })

  const basePath = `/${space.slug}/infrastructure/accounts`
  const environmentSelectOptions = useMemo(
    () => environmentOptions.map((environment) => ({ value: environment.id, label: environment.name })),
    [environmentOptions],
  )
  const canSave = useMemo(() => {
    if (isTokenType) {
      return name.trim().length > 0 && token.trim().length > 0
    }
    if (isUsernamePasswordType) {
      return name.trim().length > 0 && username.trim().length > 0 && password.trim().length > 0
    }
    if (isAwsType) {
      if (awsAuthenticationMethod !== 'AmazonWebServicesAccount') {
        return false
      }
      return name.trim().length > 0 && accessKey.trim().length > 0 && secretKey.trim().length > 0
    }
    return false
  }, [isTokenType, isUsernamePasswordType, isAwsType, awsAuthenticationMethod, name, token, username, password, accessKey, secretKey])

  const handleSave = async () => {
    if (!isSupportedType) {
      message.info('Only Token, Username/Password and AWS account creation are currently supported.')
      return
    }
    if (!canSave) return

    setSaving(true)
    try {
      if (isTokenType) {
        await createDeploymentAccount({
          spaceId: space.id,
          name: name.trim(),
          accountType: 3,
          token: token.trim(),
        })
      } else {
        if (isUsernamePasswordType) {
          await createDeploymentAccount({
            spaceId: space.id,
            name: name.trim(),
            accountType: 1,
            username: username.trim(),
            password: password.trim(),
          })
        } else {
          await createDeploymentAccount({
            spaceId: space.id,
            name: name.trim(),
            accountType: 6,
            accessKey: accessKey.trim(),
            secretKey: secretKey.trim(),
          })
        }
      }
      message.success('Account created.')
      navigate(basePath)
    } catch (error) {
      console.error('Failed to create account', error)
      message.error(error instanceof Error ? error.message : 'Failed to create account')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAndTest = async () => {
    if (!isAwsType) return
    message.info('Account testing is not available yet. Saving account only.')
    await handleSave()
  }

  useEffect(() => {
    let mounted = true
    setLoadingEnvironmentOptions(true)

    getEnvironments({ pageSize: 1000, spaceId: space.id })
      .then((response) => {
        if (!mounted) return
        setEnvironmentOptions(response.environments ?? [])
      })
      .catch((error) => {
        if (!mounted) return
        console.error('Failed to load environments', error)
        setEnvironmentOptions([])
        message.warning('Failed to load environments')
      })
      .finally(() => {
        if (mounted) setLoadingEnvironmentOptions(false)
      })

    return () => {
      mounted = false
    }
  }, [space.id])

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-[1600px] mx-auto px-8 pt-4 pb-10">
        <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
          <div className="px-6 pt-4 pb-3 border-b border-gray-200">
            <nav className="mb-2">
              <ol className="flex items-center gap-1 text-sm">
                <li>
                  <Link to={basePath} className="text-squid-blue hover:underline">
                    Accounts
                  </Link>
                </li>
              </ol>
            </nav>

            <div className="flex items-center justify-between gap-3">
              <h1 className="text-2xl font-semibold text-gray-900 m-0">Create Account</h1>
              <div className="flex items-center gap-2">
                {isAwsType && (
                  <Button
                    className="!border-gray-300 !text-gray-700 hover:!border-gray-400 hover:!text-gray-800"
                    disabled={!canSave}
                    loading={saving}
                    onClick={() => void handleSaveAndTest()}
                  >
                    Save and test
                  </Button>
                )}
                <Button
                  type="primary"
                  className="!bg-green-700 hover:!bg-green-800 !border-green-700 disabled:!bg-gray-300 disabled:!border-gray-300 disabled:!text-white"
                  disabled={!canSave}
                  loading={saving}
                  onClick={() => void handleSave()}
                >
                  Save
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700 uppercase font-semibold tracking-wide bg-transparent border-0 cursor-pointer"
                onClick={() => {
                  const allExpanded = Object.values(expanded).every(Boolean)
                  const next = !allExpanded
                  setExpanded({
                    name: next,
                    description: next,
                    username: next,
                    password: next,
                    token: next,
                    awsAuthenticationMethod: next,
                    awsAccessKey: next,
                    awsSecretKey: next,
                    environments: next,
                  })
                }}
              >
                {Object.values(expanded).every(Boolean) ? 'COLLAPSE ALL' : 'EXPAND ALL'}
              </button>
            </div>
          </div>

          {!isSupportedType && (
            <div className="px-6 py-4 text-sm text-amber-700 bg-amber-50 border-b border-amber-200">
              This account type is not supported yet. Use Token, Username/Password or AWS type for now.
            </div>
          )}

          <FormPanel
            title="Name"
            subtitle="A short, memorable, unique name for this account."
            isOpen={expanded.name}
            onToggle={() => setExpanded((prev) => ({ ...prev, name: !prev.name }))}
          >
            <Input
              placeholder="Account name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-[600px]"
            />
          </FormPanel>

          <FormPanel
            title="Description"
            subtitle="A summary explaining the use of the account to other users."
            isOpen={expanded.description}
            onToggle={() => setExpanded((prev) => ({ ...prev, description: !prev.description }))}
          >
            <Input.TextArea
              rows={3}
              placeholder="Account description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="max-w-[600px]"
            />
            <button type="button" className="mt-2 text-squid-blue hover:underline bg-transparent border-0 p-0 text-sm">
              Show markdown controls
            </button>
          </FormPanel>

          <div className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
            Credentials
          </div>

          {isTokenType && (
            <FormPanel
              title="Token"
              subtitle="The password to use to when authenticating against the remote host."
              isOpen={expanded.token}
              onToggle={() => setExpanded((prev) => ({ ...prev, token: !prev.token }))}
            >
              <div className="max-w-[600px]">
                <Input.Password
                  placeholder="Token"
                  autoComplete="new-password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </div>
            </FormPanel>
          )}

          {isUsernamePasswordType && (
            <>
              <FormPanel
                title="Username"
                subtitle="The username to use when authenticating against the remote host."
                isOpen={expanded.username}
                onToggle={() => setExpanded((prev) => ({ ...prev, username: !prev.username }))}
              >
                <div className="max-w-[600px]">
                  <Input
                    placeholder="Username"
                    autoComplete="off"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </FormPanel>

              <FormPanel
                title="Password"
                subtitle="The password to use to when authenticating against the remote host."
                isOpen={expanded.password}
                onToggle={() => setExpanded((prev) => ({ ...prev, password: !prev.password }))}
              >
                <div className="max-w-[600px]">
                  <Input.Password
                    placeholder="Password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </FormPanel>
            </>
          )}

          {isAwsType && (
            <>
              <div className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
                Amazon Web Services Details
              </div>

              <FormPanel
                title="Authentication Method"
                subtitle="Select the Amazon Web Services authentication method to show the relevant form inputs below."
                isOpen={expanded.awsAuthenticationMethod}
                onToggle={() => setExpanded((prev) => ({ ...prev, awsAuthenticationMethod: !prev.awsAuthenticationMethod }))}
              >
                <div className="max-w-[760px]">
                  <Radio.Group
                    value={awsAuthenticationMethod}
                    onChange={(e) => setAwsAuthenticationMethod(e.target.value)}
                    className="flex flex-col gap-2"
                  >
                    <Radio value="AmazonWebServicesAccount">
                      Use an Access Key <span className="text-gray-400">(default)</span>
                    </Radio>
                    <Radio value="AmazonWebServicesOidcAccount">Use OpenID Connect</Radio>
                  </Radio.Group>
                </div>
              </FormPanel>

              {awsAuthenticationMethod === 'AmazonWebServicesAccount' ? (
                <>
                  <FormPanel
                    title="Access Key"
                    subtitle="The AWS access key to use when authenticating against Amazon Web Services."
                    isOpen={expanded.awsAccessKey}
                    onToggle={() => setExpanded((prev) => ({ ...prev, awsAccessKey: !prev.awsAccessKey }))}
                  >
                    <div className="max-w-[600px]">
                      <Input
                        placeholder="Access Key"
                        autoComplete="off"
                        value={accessKey}
                        onChange={(e) => setAccessKey(e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-2 mb-0">
                        Refer to the{' '}
                        <a href="https://oc.to/AwsDocsManagingAccessKeys" target="_blank" rel="noopener noreferrer" className="text-squid-blue hover:underline">
                          AWS documentation
                        </a>{' '}
                        for information on generating access and secret keys.
                      </p>
                    </div>
                  </FormPanel>

                  <FormPanel
                    title="Secret Key"
                    subtitle="The AWS secret key to use when authenticating against Amazon Web Services."
                    isOpen={expanded.awsSecretKey}
                    onToggle={() => setExpanded((prev) => ({ ...prev, awsSecretKey: !prev.awsSecretKey }))}
                  >
                    <div className="max-w-[600px]">
                      <Input.Password
                        placeholder="Secret Key"
                        autoComplete="new-password"
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                      />
                    </div>
                  </FormPanel>
                </>
              ) : (
                <div className="px-6 py-4 text-sm text-amber-700 bg-amber-50 border-b border-amber-200">
                  OpenID Connect is not supported by Squid API create account endpoint yet.
                </div>
              )}
            </>
          )}

          <div className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
            Restrictions
          </div>

          <FormPanel
            title="Environments"
            subtitle="Choose the environments that are allowed to use this account"
            isOpen={expanded.environments}
            onToggle={() => setExpanded((prev) => ({ ...prev, environments: !prev.environments }))}
          >
            <div className="max-w-[600px]">
              <p className="text-xs text-gray-500 mb-2">
                If left blank, the account can be used for deployments to any environment.
              </p>
              <Select
                mode="multiple"
                placeholder="Select environments"
                value={selectedEnvironmentIds}
                onChange={setSelectedEnvironmentIds}
                options={environmentSelectOptions}
                loading={loadingEnvironmentOptions}
                className="w-full"
              />
            </div>
          </FormPanel>
        </div>
      </div>
    </div>
  )
}

export default AccountsCreatePage
