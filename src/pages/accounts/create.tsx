import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, Radio, Select, message } from 'antd'
import { DownOutlined, UploadOutlined } from '@ant-design/icons'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import PageContainer from 'components/PageContainer'
import { useSpace } from 'contexts/SpaceContext'
import { createDeploymentAccount } from 'pages/apis/deploymentAccount'
import { getEnvironments, type EnvironmentDto } from 'pages/apis/environment'

type SectionKey =
  | 'name'
  | 'description'
  | 'sshUsername'
  | 'sshPrivateKeyFile'
  | 'sshPassphrase'
  | 'username'
  | 'password'
  | 'token'
  | 'awsAuthenticationMethod'
  | 'awsAccessKey'
  | 'awsSecretKey'
  | 'azureSubscriptionId'
  | 'azureAuthenticationMethod'
  | 'azureTenantId'
  | 'azureApplicationId'
  | 'azureApplicationPassword'
  | 'googleCloudKeyFile'
  | 'openClawGatewayToken'
  | 'openClawHooksToken'
  | 'environments'
type AwsAuthenticationMethod = 'AmazonWebServicesAccount' | 'AmazonWebServicesOidcAccount'
type AzureAuthenticationMethod = 'AzureServicePrincipal' | 'AzureSubscription' | 'AzureOidc'

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
  const isSshKeyPairType = accountType === 2
  const isAwsType = accountType === 6
  const isAzureType = accountType === 5
  const isGoogleCloudType = accountType === 10
  const isOpenClawType = accountType === 12
  const isSupportedType = isTokenType || isUsernamePasswordType || isSshKeyPairType || isAwsType || isAzureType || isGoogleCloudType || isOpenClawType

  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sshUsername, setSshUsername] = useState('')
  const [sshPrivateKeyFile, setSshPrivateKeyFile] = useState('')
  const [sshPrivateKeyPassphrase, setSshPrivateKeyPassphrase] = useState('')
  const sshPrivateKeyFileInputRef = useRef<HTMLInputElement | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [awsAuthenticationMethod, setAwsAuthenticationMethod] = useState<AwsAuthenticationMethod>('AmazonWebServicesAccount')
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [azureSubscriptionId, setAzureSubscriptionId] = useState('')
  const [azureAuthenticationMethod, setAzureAuthenticationMethod] = useState<AzureAuthenticationMethod>('AzureServicePrincipal')
  const [azureTenantId, setAzureTenantId] = useState('')
  const [azureApplicationId, setAzureApplicationId] = useState('')
  const [azureApplicationPassword, setAzureApplicationPassword] = useState('')
  const [googleCloudJsonKey, setGoogleCloudJsonKey] = useState('')
  const [openClawGatewayToken, setOpenClawGatewayToken] = useState('')
  const [openClawHooksToken, setOpenClawHooksToken] = useState('')
  const googleCloudKeyFileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedEnvironmentIds, setSelectedEnvironmentIds] = useState<number[]>([])
  const [environmentOptions, setEnvironmentOptions] = useState<EnvironmentDto[]>([])
  const [loadingEnvironmentOptions, setLoadingEnvironmentOptions] = useState(false)
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    name: true,
    description: true,
    sshUsername: true,
    sshPrivateKeyFile: true,
    sshPassphrase: true,
    username: true,
    password: true,
    token: true,
    awsAuthenticationMethod: true,
    awsAccessKey: true,
    awsSecretKey: true,
    azureSubscriptionId: true,
    azureAuthenticationMethod: true,
    azureTenantId: true,
    azureApplicationId: true,
    azureApplicationPassword: true,
    googleCloudKeyFile: true,
    openClawGatewayToken: true,
    openClawHooksToken: true,
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
    if (isSshKeyPairType) {
      return name.trim().length > 0 && sshUsername.trim().length > 0 && sshPrivateKeyFile.trim().length > 0
    }
    if (isAwsType) {
      if (awsAuthenticationMethod !== 'AmazonWebServicesAccount') {
        return false
      }
      return name.trim().length > 0 && accessKey.trim().length > 0 && secretKey.trim().length > 0
    }
    if (isAzureType) {
      if (azureAuthenticationMethod !== 'AzureServicePrincipal') {
        return false
      }
      return (
        name.trim().length > 0
        && azureSubscriptionId.trim().length > 0
        && azureTenantId.trim().length > 0
        && azureApplicationId.trim().length > 0
        && azureApplicationPassword.trim().length > 0
      )
    }
    if (isGoogleCloudType) {
      return name.trim().length > 0 && googleCloudJsonKey.trim().length > 0
    }
    if (isOpenClawType) {
      return name.trim().length > 0 && openClawGatewayToken.trim().length > 0
    }
    return false
  }, [
    isTokenType,
    isUsernamePasswordType,
    isSshKeyPairType,
    isAwsType,
    isAzureType,
    isGoogleCloudType,
    isOpenClawType,
    awsAuthenticationMethod,
    azureAuthenticationMethod,
    name,
    sshUsername,
    sshPrivateKeyFile,
    token,
    username,
    password,
    accessKey,
    secretKey,
    azureSubscriptionId,
    azureTenantId,
    azureApplicationId,
    azureApplicationPassword,
    googleCloudJsonKey,
    openClawGatewayToken,
    openClawHooksToken,
  ])

  const handleSave = async () => {
    if (!isSupportedType) {
      message.info('Only Token, Username/Password, SSH Key Pair, AWS Access Key, Azure Service Principal, Google Cloud, and OpenClaw account creation are currently supported.')
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
          credentials: {
            token: token.trim(),
          },
          environmentIds: selectedEnvironmentIds,
          description: description.trim() || undefined,
        })
      } else {
        if (isUsernamePasswordType) {
          await createDeploymentAccount({
            spaceId: space.id,
            name: name.trim(),
            accountType: 1,
            credentials: {
              username: username.trim(),
              password: password.trim(),
            },
            environmentIds: selectedEnvironmentIds,
            description: description.trim() || undefined,
          })
        } else if (isSshKeyPairType) {
          await createDeploymentAccount({
            spaceId: space.id,
            name: name.trim(),
            accountType: 2,
            credentials: {
              username: sshUsername.trim(),
              privateKeyFile: sshPrivateKeyFile.trim(),
              ...(sshPrivateKeyPassphrase.trim().length > 0 ? { privateKeyPassphrase: sshPrivateKeyPassphrase.trim() } : {}),
            },
            environmentIds: selectedEnvironmentIds,
            description: description.trim() || undefined,
          })
        } else if (isAwsType) {
          await createDeploymentAccount({
            spaceId: space.id,
            name: name.trim(),
            accountType: 6,
            credentials: {
              accessKey: accessKey.trim(),
              secretKey: secretKey.trim(),
            },
            environmentIds: selectedEnvironmentIds,
            description: description.trim() || undefined,
          })
        } else if (isAzureType) {
          await createDeploymentAccount({
            spaceId: space.id,
            name: name.trim(),
            accountType: 5,
            credentials: {
              subscriptionNumber: azureSubscriptionId.trim(),
              tenantId: azureTenantId.trim(),
              clientId: azureApplicationId.trim(),
              key: azureApplicationPassword.trim(),
            },
            environmentIds: selectedEnvironmentIds,
            description: description.trim() || undefined,
          })
        } else if (isGoogleCloudType) {
          await createDeploymentAccount({
            spaceId: space.id,
            name: name.trim(),
            accountType: 10,
            credentials: {
              jsonKey: googleCloudJsonKey.trim(),
            },
            environmentIds: selectedEnvironmentIds,
            description: description.trim() || undefined,
          })
        } else if (isOpenClawType) {
          const gatewayToken = openClawGatewayToken.trim()
          const hooksToken = openClawHooksToken.trim()
          await createDeploymentAccount({
            spaceId: space.id,
            name: name.trim(),
            accountType: 12,
            credentials: {
              gatewayToken,
              ...(hooksToken.length > 0 ? { hooksToken } : {}),
            },
            environmentIds: selectedEnvironmentIds,
            description: description.trim() || undefined,
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
    if (!isAwsType && !isAzureType && !isGoogleCloudType) return
    message.info('Account testing is not available yet. Saving account only.')
    await handleSave()
  }

  const handleGoogleCloudKeyFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const fileText = await file.text()
      const trimmed = fileText.trim()
      if (!trimmed) {
        message.warning('The uploaded key file is empty.')
        return
      }

      JSON.parse(trimmed)
      setGoogleCloudJsonKey(trimmed)
      message.success('Google Cloud key file loaded.')
    } catch (error) {
      console.error('Failed to parse Google Cloud key file', error)
      message.error('Invalid key file. Please upload a valid JSON key file.')
    }
  }

  const handleSshPrivateKeyFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const fileText = await file.text()
      const trimmed = fileText.trim()
      if (!trimmed) {
        message.warning('The uploaded private key file is empty.')
        return
      }
      setSshPrivateKeyFile(trimmed)
      message.success('Private key file loaded.')
    } catch (error) {
      console.error('Failed to read private key file', error)
      message.error('Failed to read private key file.')
    }
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
    <PageContainer>
        <div className="border border-slate-200/70 rounded-xl bg-white overflow-hidden shadow-card">
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
                {(isAwsType || isAzureType || isGoogleCloudType) && (
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
                    sshUsername: next,
                    sshPrivateKeyFile: next,
                    sshPassphrase: next,
                    username: next,
                    password: next,
                    token: next,
                    awsAuthenticationMethod: next,
                    awsAccessKey: next,
                    awsSecretKey: next,
                    azureSubscriptionId: next,
                    azureAuthenticationMethod: next,
                    azureTenantId: next,
                    azureApplicationId: next,
                    azureApplicationPassword: next,
                    googleCloudKeyFile: next,
                    openClawGatewayToken: next,
                    openClawHooksToken: next,
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
              This account type is not supported yet. Use Token, Username/Password, SSH Key Pair, AWS Access Key, Azure Service Principal, Google Cloud, or OpenClaw for now.
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

          {isSshKeyPairType && (
            <>
              <div className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
                Ssh Key Pair Settings
              </div>

              <FormPanel
                title="Username"
                subtitle="The username to use when authenticating against the remote host."
                isOpen={expanded.sshUsername}
                onToggle={() => setExpanded((prev) => ({ ...prev, sshUsername: !prev.sshUsername }))}
              >
                <div className="max-w-[600px]">
                  <Input
                    placeholder="Username"
                    autoComplete="off"
                    value={sshUsername}
                    onChange={(e) => setSshUsername(e.target.value)}
                  />
                </div>
              </FormPanel>

              <FormPanel
                title="Private Key File"
                subtitle="Upload the private key file portion of the key pair."
                isOpen={expanded.sshPrivateKeyFile}
                onToggle={() => setExpanded((prev) => ({ ...prev, sshPrivateKeyFile: !prev.sshPrivateKeyFile }))}
              >
                <div className="max-w-[760px]">
                  <div className="flex items-start gap-2">
                    <Input
                      placeholder="Private key file"
                      autoComplete="off"
                      value={sshPrivateKeyFile}
                      onChange={(e) => setSshPrivateKeyFile(e.target.value)}
                      className="max-w-[600px]"
                    />
                    <Button
                      icon={<UploadOutlined />}
                      aria-label="Upload"
                      onClick={() => sshPrivateKeyFileInputRef.current?.click()}
                    />
                    <input
                      ref={sshPrivateKeyFileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(event) => void handleSshPrivateKeyFileUpload(event)}
                    />
                  </div>
                </div>
              </FormPanel>

              <FormPanel
                title="Passphrase"
                subtitle="The passphrase for the private key, if required."
                isOpen={expanded.sshPassphrase}
                onToggle={() => setExpanded((prev) => ({ ...prev, sshPassphrase: !prev.sshPassphrase }))}
              >
                <div className="max-w-[600px]">
                  <Input.Password
                    placeholder="Passphrase"
                    autoComplete="new-password"
                    value={sshPrivateKeyPassphrase}
                    onChange={(e) => setSshPrivateKeyPassphrase(e.target.value)}
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

          {isAzureType && (
            <>
              <div className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
                Azure Details
              </div>

              <FormPanel
                title="Subscription ID"
                subtitle="Your Azure subscription ID. This is a GUID in the format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx."
                isOpen={expanded.azureSubscriptionId}
                onToggle={() => setExpanded((prev) => ({ ...prev, azureSubscriptionId: !prev.azureSubscriptionId }))}
              >
                <div className="max-w-[600px]">
                  <Input
                    placeholder="Subscription"
                    autoComplete="off"
                    value={azureSubscriptionId}
                    onChange={(e) => setAzureSubscriptionId(e.target.value)}
                  />
                </div>
              </FormPanel>

              <FormPanel
                title="Authentication Method"
                subtitle="Select the Azure authentication method to show the relevant form inputs below."
                isOpen={expanded.azureAuthenticationMethod}
                onToggle={() => setExpanded((prev) => ({ ...prev, azureAuthenticationMethod: !prev.azureAuthenticationMethod }))}
              >
                <div className="max-w-[760px]">
                  <Radio.Group
                    value={azureAuthenticationMethod}
                    onChange={(e) => setAzureAuthenticationMethod(e.target.value)}
                    className="flex flex-col gap-2"
                  >
                    <Radio value="AzureServicePrincipal">
                      Use a Service Principal <span className="text-gray-400">(default)</span>
                    </Radio>
                    <Radio value="AzureSubscription">Use a Management Certificate</Radio>
                    <Radio value="AzureOidc">Use OpenID Connect</Radio>
                  </Radio.Group>
                </div>
              </FormPanel>

              {azureAuthenticationMethod === 'AzureServicePrincipal' ? (
                <>
                  <FormPanel
                    title="Tenant ID"
                    subtitle="Your Azure Active Directory Tenant ID. This is a GUID in the format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx."
                    isOpen={expanded.azureTenantId}
                    onToggle={() => setExpanded((prev) => ({ ...prev, azureTenantId: !prev.azureTenantId }))}
                  >
                    <div className="max-w-[600px]">
                      <Input
                        placeholder="Active Directory Tenant ID"
                        autoComplete="off"
                        value={azureTenantId}
                        onChange={(e) => setAzureTenantId(e.target.value)}
                      />
                    </div>
                  </FormPanel>

                  <FormPanel
                    title="Application ID"
                    subtitle="Your Azure Active Directory Application ID. This is a GUID in the format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx."
                    isOpen={expanded.azureApplicationId}
                    onToggle={() => setExpanded((prev) => ({ ...prev, azureApplicationId: !prev.azureApplicationId }))}
                  >
                    <div className="max-w-[600px]">
                      <Input
                        placeholder="Active Directory Application ID"
                        autoComplete="off"
                        value={azureApplicationId}
                        onChange={(e) => setAzureApplicationId(e.target.value)}
                      />
                    </div>
                  </FormPanel>

                  <FormPanel
                    title="Application Password / Key"
                    subtitle="The password for the Azure Active Directory application. This value is known as Key in the Azure Portal, and Password in the API."
                    isOpen={expanded.azureApplicationPassword}
                    onToggle={() => setExpanded((prev) => ({ ...prev, azureApplicationPassword: !prev.azureApplicationPassword }))}
                  >
                    <div className="max-w-[600px]">
                      <Input.Password
                        placeholder="Active Directory Password/Key"
                        autoComplete="new-password"
                        value={azureApplicationPassword}
                        onChange={(e) => setAzureApplicationPassword(e.target.value)}
                      />
                    </div>
                  </FormPanel>
                </>
              ) : (
                <div className="px-6 py-4 text-sm text-amber-700 bg-amber-50 border-b border-amber-200">
                  This authentication method is not supported by Squid API create account endpoint yet.
                </div>
              )}
            </>
          )}

          {isGoogleCloudType && (
            <FormPanel
              title="Key File"
              subtitle="The json key file to use when authenticating against Google Cloud."
              isOpen={expanded.googleCloudKeyFile}
              onToggle={() => setExpanded((prev) => ({ ...prev, googleCloudKeyFile: !prev.googleCloudKeyFile }))}
            >
              <div className="max-w-[760px]">
                <div className="flex items-start gap-2">
                  <Input
                    placeholder="Key File"
                    autoComplete="off"
                    value={googleCloudJsonKey}
                    onChange={(e) => setGoogleCloudJsonKey(e.target.value)}
                    className="max-w-[600px]"
                  />
                  <Button
                    icon={<UploadOutlined />}
                    aria-label="Upload"
                    onClick={() => googleCloudKeyFileInputRef.current?.click()}
                  />
                  <input
                    ref={googleCloudKeyFileInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(event) => void handleGoogleCloudKeyFileUpload(event)}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 mb-0">
                  Refer to the{' '}
                  <a href="https://oc.to/GoogleCloudServiceAccountKey" target="_blank" rel="noopener noreferrer" className="text-squid-blue hover:underline">
                    Google cloud documentation
                  </a>{' '}
                  for information on generating json key for service accounts.
                </p>
              </div>
            </FormPanel>
          )}

          {isOpenClawType && (
            <>
              <div className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
                OpenClaw Details
              </div>

              <FormPanel
                title="Gateway Token"
                subtitle={(
                  <span>
                    Required. Used for <code>/tools/invoke</code> and <code>/v1/chat/completions</code>.
                  </span>
                )}
                isOpen={expanded.openClawGatewayToken}
                onToggle={() => setExpanded((prev) => ({ ...prev, openClawGatewayToken: !prev.openClawGatewayToken }))}
              >
                <div className="max-w-[600px]">
                  <Input.Password
                    placeholder="oc_gw_xxxxxxxxxxxx"
                    autoComplete="new-password"
                    value={openClawGatewayToken}
                    onChange={(e) => setOpenClawGatewayToken(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-2 mb-0">
                    Get it: <code>openclaw config get gateway.auth.token</code>
                  </p>
                </div>
              </FormPanel>

              <FormPanel
                title="Hooks Token"
                subtitle={(
                  <span>
                    Required only for RunAgent and Wake actions.
                  </span>
                )}
                isOpen={expanded.openClawHooksToken}
                onToggle={() => setExpanded((prev) => ({ ...prev, openClawHooksToken: !prev.openClawHooksToken }))}
              >
                <div className="max-w-[600px]">
                  <Input.Password
                    placeholder="oc_hk_xxxxxxxxxxxx"
                    autoComplete="new-password"
                    value={openClawHooksToken}
                    onChange={(e) => setOpenClawHooksToken(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-2 mb-0">
                    OpenClaw uses a separate token for <code>/hooks/*</code> endpoints.
                  </p>
                  <p className="text-xs text-gray-500 mt-1 mb-0">
                    Get it: <code>openclaw config get hooks.token</code>
                  </p>
                  <p className="text-xs text-gray-500 mt-1 mb-0">
                    Set it: <code>openclaw config set hooks.token &lt;value&gt;</code>
                  </p>
                </div>
              </FormPanel>
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
    </PageContainer>
  )
}

export default AccountsCreatePage
