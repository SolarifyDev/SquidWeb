import React, { useEffect, useMemo, useState } from 'react'
import { Button, Dropdown, Input, Modal, message, Spin } from 'antd'
import type { MenuProps } from 'antd'
import { DownOutlined, MoreOutlined } from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSpace } from 'contexts/SpaceContext'
import { getEnvironments } from 'pages/apis/environment'
import {
  AwsCredentialsSummary,
  AzureOidcCredentialsSummary,
  AzureServicePrincipalCredentialsSummary,
  ClientCertificateCredentialsSummary,
  DeploymentAccountDto,
  GcpCredentialsSummary,
  OpenClawGatewayCredentialsSummary,
  SshKeyPairCredentialsSummary,
  TokenCredentialsSummary,
  UsernamePasswordCredentialsSummary,
  deleteDeploymentAccount,
  getDeploymentAccounts,
} from 'pages/apis/deploymentAccount'

type SectionKey =
  | 'name'
  | 'description'
  | 'token'
  | 'username'
  | 'password'
  | 'accessKey'
  | 'secretKey'
  | 'credentialSummary'
  | 'environments'

type ActiveTab = 'details' | 'usage'

type DeploymentAccountLike = DeploymentAccountDto & {
  description?: string
  notes?: string
  environmentNames?: unknown
  environments?: unknown
  environmentIds?: unknown
  scopes?: unknown
}

interface AccountDetailViewModel {
  id: number
  name: string
  slug: string
  accountType: number
  description?: string
  environments: string[]
  credentials: DeploymentAccountDto['credentials']
}

interface DetailPanelProps {
  title: string
  subtitle?: React.ReactNode
  subtitlePlaceholder?: boolean
  isOpen: boolean
  onToggle: () => void
  hasBorder?: boolean
  children?: React.ReactNode
}

function DetailPanel({
  title,
  subtitle,
  subtitlePlaceholder = false,
  isOpen,
  onToggle,
  hasBorder = true,
  children,
}: DetailPanelProps) {
  return (
    <div className={hasBorder ? 'border-b border-gray-200' : ''}>
      <div
        className="grid items-start py-4 pl-6 pr-6 cursor-pointer select-none"
        style={{ gridTemplateColumns: '260px 1fr auto' }}
        onClick={onToggle}
      >
        <div className="text-base font-bold text-gray-900 pt-0.5">{title}</div>
        <div className={subtitlePlaceholder ? 'text-sm text-gray-400 pt-0.5' : 'text-sm text-gray-500 pt-0.5'}>{subtitle}</div>
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

function readStringArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'name' in item && typeof (item as { name?: unknown }).name === 'string') {
          return (item as { name: string }).name
        }
        return ''
      })
      .map((value) => value.trim())
      .filter(Boolean)
  }

  if (typeof input === 'string') {
    return input
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  }

  return []
}

function readNumberArray(input: unknown): number[] {
  if (Array.isArray(input)) {
    return input
      .map((item) => Number(item))
      .filter((value) => Number.isFinite(value))
  }

  if (typeof input === 'string') {
    return input
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value))
  }

  return []
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const raw of values) {
    const value = raw.trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(value)
  }
  return output
}

function extractEnvironmentNames(account: DeploymentAccountLike, envById: Map<number, string>): string[] {
  const explicitNameCandidates: unknown[] = [account.environmentNames, account.environments]
  const explicitNames = explicitNameCandidates.flatMap((candidate) => readStringArray(candidate))
  if (explicitNames.length > 0) {
    return unique(explicitNames)
  }

  const ids = readNumberArray(account.environmentIds)
  if (ids.length > 0) {
    return unique(ids.map((id) => envById.get(id) ?? `Environment-${id}`))
  }

  if (Array.isArray(account.scopes)) {
    const scopeNames = (account.scopes as Array<Record<string, unknown>>)
      .filter((scope) => {
        const scopeType = scope.scopeType
        if (typeof scopeType === 'string') {
          return scopeType.toLowerCase().includes('environment')
        }
        if (typeof scopeType === 'number') {
          return scopeType === 1
        }
        return false
      })
      .map((scope) => String(scope.scopeValue ?? '').trim())
      .filter(Boolean)
    return unique(scopeNames)
  }

  return []
}

function extractDescription(account: DeploymentAccountLike): string | undefined {
  const directDescription = String(account.description ?? '').trim()
  if (directDescription) return directDescription

  const notes = String(account.notes ?? '').trim()
  if (notes) return notes

  return undefined
}

function isTokenCredentials(creds: DeploymentAccountDto['credentials']): creds is TokenCredentialsSummary {
  return !!creds && typeof creds === 'object' && 'tokenHasValue' in creds
}

function isUsernamePasswordCredentials(creds: DeploymentAccountDto['credentials']): creds is UsernamePasswordCredentialsSummary {
  return !!creds && typeof creds === 'object' && 'passwordHasValue' in creds && 'username' in creds
}

function isAwsCredentials(creds: DeploymentAccountDto['credentials']): creds is AwsCredentialsSummary {
  return !!creds && typeof creds === 'object' && 'secretKeyHasValue' in creds && 'accessKey' in creds
}

function isAzureServicePrincipalCredentials(creds: DeploymentAccountDto['credentials']): creds is AzureServicePrincipalCredentialsSummary {
  return !!creds
    && typeof creds === 'object'
    && 'subscriptionNumber' in creds
    && 'clientId' in creds
    && 'tenantId' in creds
    && 'keyHasValue' in creds
}

function isAzureOidcCredentials(creds: DeploymentAccountDto['credentials']): creds is AzureOidcCredentialsSummary {
  return !!creds
    && typeof creds === 'object'
    && 'subscriptionNumber' in creds
    && 'clientId' in creds
    && 'tenantId' in creds
    && 'jwtHasValue' in creds
}

function isSshKeyPairCredentials(creds: DeploymentAccountDto['credentials']): creds is SshKeyPairCredentialsSummary {
  return !!creds
    && typeof creds === 'object'
    && 'username' in creds
    && 'privateKeyFileHasValue' in creds
}

function isClientCertificateCredentials(creds: DeploymentAccountDto['credentials']): creds is ClientCertificateCredentialsSummary {
  return !!creds
    && typeof creds === 'object'
    && 'certificateDataHasValue' in creds
    && 'certificateKeyDataHasValue' in creds
}

function isGcpCredentials(creds: DeploymentAccountDto['credentials']): creds is GcpCredentialsSummary {
  return !!creds
    && typeof creds === 'object'
    && 'jsonKeyHasValue' in creds
}

function isOpenClawGatewayCredentials(creds: DeploymentAccountDto['credentials']): creds is OpenClawGatewayCredentialsSummary {
  return !!creds
    && typeof creds === 'object'
    && 'gatewayTokenHasValue' in creds
    && 'hooksTokenHasValue' in creds
}

function matchAccount(account: DeploymentAccountLike, accountSlug: string): boolean {
  const normalized = accountSlug.trim().toLowerCase()
  if (!normalized) return false
  if (account.slug?.toLowerCase() === normalized) return true
  if (`accounts-${account.id}`.toLowerCase() === normalized) return true
  if (String(account.id) === accountSlug) return true
  return false
}

const AccountsDetailPage: React.FC = () => {
  const navigate = useNavigate()
  const { space } = useSpace()
  const { accountSlug = '' } = useParams()
  const [activeTab, setActiveTab] = useState<ActiveTab>('details')
  const [loading, setLoading] = useState(false)
  const [account, setAccount] = useState<AccountDetailViewModel | null>(null)

  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    name: false,
    description: false,
    token: false,
    username: false,
    password: false,
    accessKey: false,
    secretKey: false,
    credentialSummary: false,
    environments: false,
  })

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const [accountRes, envRes] = await Promise.all([
          getDeploymentAccounts({ pageSize: 1000, spaceId: space.id }),
          getEnvironments({ pageSize: 1000, spaceId: space.id }),
        ])
        if (!mounted) return

        const envById = new Map<number, string>()
        for (const env of envRes.environments ?? []) {
          envById.set(env.id, env.name)
        }

        const candidate = (accountRes.deploymentAccounts ?? [])
          .map((item) => item as DeploymentAccountLike)
          .find((item) => matchAccount(item, accountSlug))

        if (!candidate) {
          setAccount(null)
          return
        }

        setAccount({
          id: candidate.id,
          name: candidate.name,
          slug: candidate.slug || `Accounts-${candidate.id}`,
          accountType: candidate.accountType,
          description: extractDescription(candidate),
          environments: extractEnvironmentNames(candidate, envById),
          credentials: candidate.credentials,
        })
      } catch (error) {
        console.error('Failed to load account detail', error)
        if (mounted) {
          setAccount(null)
          message.error('Failed to load account detail')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [space.id, accountSlug])

  const basePath = `/${space.slug}/infrastructure/accounts`

  const overflowMenuItems: MenuProps['items'] = useMemo(
    () => [
      { key: 'disable', label: 'Disable' },
      { key: 'delete', label: 'Delete' },
      { type: 'divider' },
      { key: 'audit', label: 'Audit Trail' },
    ],
    [],
  )

  const handleOverflowClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'delete') {
      if (!account) {
        message.error('Account not found')
        return
      }

      Modal.confirm({
        title: 'Delete Account',
        content: `Are you sure you want to delete "${account.name}"? This action cannot be undone.`,
        okText: 'Delete',
        okButtonProps: { danger: true },
        cancelText: 'Cancel',
        centered: true,
        onOk: async () => {
          try {
            await deleteDeploymentAccount({ id: account.id, spaceId: space.id })
            message.success('Account deleted')
            navigate(basePath)
          } catch (error: any) {
            message.error(error?.message || 'Failed to delete account')
          }
        },
      })
      return
    }

    if (key === 'audit') {
      message.info('Audit Trail is not available yet.')
      return
    }
    message.info(`${String(key)} is not implemented yet.`)
  }

  const allExpanded = Object.values(expanded).every(Boolean)
  const isTokenAccount = !!account && account.accountType === 3 && isTokenCredentials(account.credentials)
  const isUsernamePasswordAccount = !!account && account.accountType === 1 && isUsernamePasswordCredentials(account.credentials)
  const isAwsAccount = !!account && (account.accountType === 6 || account.accountType === 7) && isAwsCredentials(account.credentials)
  const isAzureServicePrincipalAccount = !!account && account.accountType === 5 && isAzureServicePrincipalCredentials(account.credentials)
  const isAzureOidcAccount = !!account && account.accountType === 9 && isAzureOidcCredentials(account.credentials)
  const isSshKeyPairAccount = !!account && account.accountType === 2 && isSshKeyPairCredentials(account.credentials)
  const isClientCertificateAccount = !!account && account.accountType === 8 && isClientCertificateCredentials(account.credentials)
  const isGoogleCloudAccount = !!account && account.accountType === 10 && isGcpCredentials(account.credentials)
  const isOpenClawGatewayAccount = !!account && account.accountType === 12 && isOpenClawGatewayCredentials(account.credentials)
  const hasTypedCredentialSummary = isTokenAccount
    || isUsernamePasswordAccount
    || isAwsAccount
    || isAzureServicePrincipalAccount
    || isAzureOidcAccount
    || isSshKeyPairAccount
    || isClientCertificateAccount
    || isGoogleCloudAccount
    || isOpenClawGatewayAccount
  const tokenCredentials = isTokenAccount ? account?.credentials as TokenCredentialsSummary : null
  const usernamePasswordCredentials = isUsernamePasswordAccount ? account?.credentials as UsernamePasswordCredentialsSummary : null
  const awsCredentials = isAwsAccount ? account?.credentials as AwsCredentialsSummary : null
  const azureServicePrincipalCredentials = isAzureServicePrincipalAccount ? account?.credentials as AzureServicePrincipalCredentialsSummary : null
  const azureOidcCredentials = isAzureOidcAccount ? account?.credentials as AzureOidcCredentialsSummary : null
  const sshKeyPairCredentials = isSshKeyPairAccount ? account?.credentials as SshKeyPairCredentialsSummary : null
  const clientCertificateCredentials = isClientCertificateAccount ? account?.credentials as ClientCertificateCredentialsSummary : null
  const gcpCredentials = isGoogleCloudAccount ? account?.credentials as GcpCredentialsSummary : null
  const openClawGatewayCredentials = isOpenClawGatewayAccount ? account?.credentials as OpenClawGatewayCredentialsSummary : null

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
              <h1 className="text-2xl font-semibold text-gray-900 m-0">{account?.name || 'Account'}</h1>
              <div className="flex items-center gap-2">
                <Button
                  type="primary"
                  className="!bg-green-700 hover:!bg-green-800 !border-green-700 disabled:!bg-gray-300 disabled:!border-gray-300 disabled:!text-white"
                  disabled
                >
                  Save
                </Button>
                <Dropdown menu={{ items: overflowMenuItems, onClick: handleOverflowClick }} trigger={['click']}>
                  <Button icon={<MoreOutlined />} aria-label="Overflow Menu Button" />
                </Dropdown>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700 uppercase font-semibold tracking-wide bg-transparent border-0 cursor-pointer"
                onClick={() => {
                  const next = !allExpanded
                  setExpanded({
                    name: next,
                    description: next,
                    token: next,
                    username: next,
                    password: next,
                    accessKey: next,
                    secretKey: next,
                    credentialSummary: next,
                    environments: next,
                  })
                }}
              >
                {allExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
              </button>
            </div>
          </div>

          <div className="px-6 pt-3 border-b border-gray-200">
            <div className="flex">
              <button
                type="button"
                className={`px-4 py-3 text-sm font-medium border-0 bg-transparent cursor-pointer ${
                  activeTab === 'details'
                    ? 'text-gray-900 border-b-2 border-squid-blue'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('details')}
              >
                Details
              </button>
              <button
                type="button"
                className={`px-4 py-3 text-sm font-medium border-0 bg-transparent cursor-pointer ${
                  activeTab === 'usage'
                    ? 'text-gray-900 border-b-2 border-squid-blue'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('usage')}
              >
                Usage
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <Spin tip="Loading account detail..." />
            </div>
          ) : !account ? (
            <div className="px-6 py-8 text-sm text-gray-500">Account not found.</div>
          ) : activeTab === 'usage' ? (
            <div className="px-6 py-8 text-sm text-gray-500">Usage data is not available yet.</div>
          ) : (
            <>
              <DetailPanel
                title="Name"
                subtitle={
                  <span className="flex flex-col">
                    <span className="text-gray-700 font-medium">{account.name}</span>
                    <span className="text-gray-400">{account.slug}</span>
                  </span>
                }
                isOpen={expanded.name}
                onToggle={() => setExpanded((prev) => ({ ...prev, name: !prev.name }))}
              >
                <div className="max-w-[600px] space-y-2">
                  <Input value={account.name} disabled />
                  <Input value={account.slug} disabled />
                </div>
              </DetailPanel>

              <DetailPanel
                title="Description"
                subtitle={account.description || 'No account description provided'}
                subtitlePlaceholder={!account.description}
                isOpen={expanded.description}
                onToggle={() => setExpanded((prev) => ({ ...prev, description: !prev.description }))}
              >
                <div className="max-w-[600px]">
                  <Input.TextArea rows={3} value={account.description || ''} disabled placeholder="No account description provided" />
                </div>
              </DetailPanel>

              <div className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
                Credentials
              </div>

              {isTokenAccount && (
                <DetailPanel
                  title="Token"
                  subtitle={tokenCredentials?.tokenHasValue ? '********' : 'No token set'}
                  isOpen={expanded.token}
                  onToggle={() => setExpanded((prev) => ({ ...prev, token: !prev.token }))}
                >
                  <div className="max-w-[600px]">
                    <Input.Password value="" placeholder="********" disabled />
                  </div>
                </DetailPanel>
              )}

              {isUsernamePasswordAccount && (
                <>
                  <DetailPanel
                    title="Username"
                    subtitle={usernamePasswordCredentials?.username || 'No username set'}
                    subtitlePlaceholder={!usernamePasswordCredentials?.username}
                    isOpen={expanded.username}
                    onToggle={() => setExpanded((prev) => ({ ...prev, username: !prev.username }))}
                  >
                    <div className="max-w-[600px]">
                      <Input value={usernamePasswordCredentials?.username || ''} disabled />
                    </div>
                  </DetailPanel>

                  <DetailPanel
                    title="Password"
                    subtitle={usernamePasswordCredentials?.passwordHasValue ? '********' : 'No password set'}
                    subtitlePlaceholder={!usernamePasswordCredentials?.passwordHasValue}
                    isOpen={expanded.password}
                    onToggle={() => setExpanded((prev) => ({ ...prev, password: !prev.password }))}
                  >
                    <div className="max-w-[600px]">
                      <Input.Password value="" placeholder="********" disabled />
                    </div>
                  </DetailPanel>
                </>
              )}

              {isAwsAccount && (
                <>
                  <DetailPanel
                    title="Access Key"
                    subtitle={awsCredentials?.accessKey || 'No access key set'}
                    subtitlePlaceholder={!awsCredentials?.accessKey}
                    isOpen={expanded.accessKey}
                    onToggle={() => setExpanded((prev) => ({ ...prev, accessKey: !prev.accessKey }))}
                  >
                    <div className="max-w-[600px]">
                      <Input value={awsCredentials?.accessKey || ''} disabled />
                    </div>
                  </DetailPanel>

                  <DetailPanel
                    title="Secret Key"
                    subtitle={awsCredentials?.secretKeyHasValue ? '********' : 'No secret key set'}
                    subtitlePlaceholder={!awsCredentials?.secretKeyHasValue}
                    isOpen={expanded.secretKey}
                    onToggle={() => setExpanded((prev) => ({ ...prev, secretKey: !prev.secretKey }))}
                  >
                    <div className="max-w-[600px]">
                      <Input.Password value="" placeholder="********" disabled />
                    </div>
                  </DetailPanel>
                </>
              )}

              {isAzureServicePrincipalAccount && (
                <DetailPanel
                  title="Azure Service Principal"
                  subtitle={
                    azureServicePrincipalCredentials?.subscriptionNumber
                      ? `Subscription: ${azureServicePrincipalCredentials.subscriptionNumber}`
                      : 'No subscription configured'
                  }
                  subtitlePlaceholder={!azureServicePrincipalCredentials?.subscriptionNumber}
                  isOpen={expanded.credentialSummary}
                  onToggle={() => setExpanded((prev) => ({ ...prev, credentialSummary: !prev.credentialSummary }))}
                >
                  <div className="max-w-[600px] space-y-2">
                    <Input value={azureServicePrincipalCredentials?.subscriptionNumber || ''} disabled placeholder="Subscription ID" />
                    <Input value={azureServicePrincipalCredentials?.tenantId || ''} disabled placeholder="Tenant ID" />
                    <Input value={azureServicePrincipalCredentials?.clientId || ''} disabled placeholder="Application ID" />
                    <Input.Password value="" placeholder={azureServicePrincipalCredentials?.keyHasValue ? '********' : 'No key set'} disabled />
                  </div>
                </DetailPanel>
              )}

              {isAzureOidcAccount && (
                <DetailPanel
                  title="Azure OIDC"
                  subtitle={
                    azureOidcCredentials?.subscriptionNumber
                      ? `Subscription: ${azureOidcCredentials.subscriptionNumber}`
                      : 'No subscription configured'
                  }
                  subtitlePlaceholder={!azureOidcCredentials?.subscriptionNumber}
                  isOpen={expanded.credentialSummary}
                  onToggle={() => setExpanded((prev) => ({ ...prev, credentialSummary: !prev.credentialSummary }))}
                >
                  <div className="max-w-[600px] space-y-2">
                    <Input value={azureOidcCredentials?.subscriptionNumber || ''} disabled placeholder="Subscription ID" />
                    <Input value={azureOidcCredentials?.tenantId || ''} disabled placeholder="Tenant ID" />
                    <Input value={azureOidcCredentials?.clientId || ''} disabled placeholder="Application ID" />
                    <Input.Password value="" placeholder={azureOidcCredentials?.jwtHasValue ? '********' : 'No JWT value set'} disabled />
                  </div>
                </DetailPanel>
              )}

              {isSshKeyPairAccount && (
                <DetailPanel
                  title="SSH Key Pair"
                  subtitle={sshKeyPairCredentials?.username || 'No username set'}
                  subtitlePlaceholder={!sshKeyPairCredentials?.username}
                  isOpen={expanded.credentialSummary}
                  onToggle={() => setExpanded((prev) => ({ ...prev, credentialSummary: !prev.credentialSummary }))}
                >
                  <div className="max-w-[600px] space-y-2">
                    <Input value={sshKeyPairCredentials?.username || ''} disabled placeholder="Username" />
                    <Input.Password value="" placeholder={sshKeyPairCredentials?.privateKeyFileHasValue ? '********' : 'No private key set'} disabled />
                    <Input.Password value="" placeholder={sshKeyPairCredentials?.passphraseHasValue ? '********' : 'No passphrase set'} disabled />
                  </div>
                </DetailPanel>
              )}

              {isClientCertificateAccount && (
                <DetailPanel
                  title="Client Certificate"
                  subtitle={
                    clientCertificateCredentials?.certificateDataHasValue || clientCertificateCredentials?.certificateKeyDataHasValue
                      ? 'Certificate configured'
                      : 'No certificate configured'
                  }
                  subtitlePlaceholder={!clientCertificateCredentials?.certificateDataHasValue && !clientCertificateCredentials?.certificateKeyDataHasValue}
                  isOpen={expanded.credentialSummary}
                  onToggle={() => setExpanded((prev) => ({ ...prev, credentialSummary: !prev.credentialSummary }))}
                >
                  <div className="max-w-[600px] space-y-2">
                    <Input.Password value="" placeholder={clientCertificateCredentials?.certificateDataHasValue ? '********' : 'No certificate data'} disabled />
                    <Input.Password value="" placeholder={clientCertificateCredentials?.certificateKeyDataHasValue ? '********' : 'No certificate key data'} disabled />
                  </div>
                </DetailPanel>
              )}

              {isGoogleCloudAccount && (
                <DetailPanel
                  title="Google Cloud"
                  subtitle={gcpCredentials?.jsonKeyHasValue ? 'Key file configured' : 'No key file set'}
                  subtitlePlaceholder={!gcpCredentials?.jsonKeyHasValue}
                  isOpen={expanded.credentialSummary}
                  onToggle={() => setExpanded((prev) => ({ ...prev, credentialSummary: !prev.credentialSummary }))}
                >
                  <div className="max-w-[600px] space-y-2">
                    <Input.Password value="" placeholder={gcpCredentials?.jsonKeyHasValue ? '********' : 'No key file set'} disabled />
                  </div>
                </DetailPanel>
              )}

              {isOpenClawGatewayAccount && (
                <DetailPanel
                  title="OpenClaw Gateway"
                  subtitle={
                    openClawGatewayCredentials?.gatewayTokenHasValue || openClawGatewayCredentials?.hooksTokenHasValue
                      ? 'Gateway and hooks token summary available'
                      : 'No OpenClaw tokens set'
                  }
                  subtitlePlaceholder={!openClawGatewayCredentials?.gatewayTokenHasValue && !openClawGatewayCredentials?.hooksTokenHasValue}
                  isOpen={expanded.credentialSummary}
                  onToggle={() => setExpanded((prev) => ({ ...prev, credentialSummary: !prev.credentialSummary }))}
                >
                  <div className="max-w-[600px] space-y-2">
                    <Input.Password
                      value=""
                      placeholder={openClawGatewayCredentials?.gatewayTokenHasValue ? 'Gateway token is configured' : 'No gateway token set'}
                      disabled
                    />
                    <Input.Password
                      value=""
                      placeholder={openClawGatewayCredentials?.hooksTokenHasValue ? 'Hooks token is configured' : 'No hooks token set'}
                      disabled
                    />
                  </div>
                </DetailPanel>
              )}

              {!hasTypedCredentialSummary && (
                <DetailPanel
                  title="Credential Summary"
                  subtitle="Summary is not available for this account type."
                  subtitlePlaceholder
                  isOpen={expanded.credentialSummary}
                  onToggle={() => setExpanded((prev) => ({ ...prev, credentialSummary: !prev.credentialSummary }))}
                >
                  <div className="text-sm text-gray-600">
                    This account type does not expose a detailed credential summary in the current list API response.
                  </div>
                </DetailPanel>
              )}

              <div className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
                Restrictions
              </div>

              <DetailPanel
                title="Environments"
                subtitle={
                  account.environments.length > 0
                    ? account.environments.join(', ')
                    : 'Available for deployments to any environment'
                }
                isOpen={expanded.environments}
                onToggle={() => setExpanded((prev) => ({ ...prev, environments: !prev.environments }))}
              >
                <div className="text-sm text-gray-600">
                  {account.environments.length > 0
                    ? account.environments.map((env) => (
                      <span key={env} className="inline-flex items-center rounded-full border border-gray-200 bg-white text-gray-700 text-xs mr-2 mb-2 px-2 py-1">
                        {env}
                      </span>
                    ))
                    : 'This account can be used for deployments to any environment.'}
                </div>
              </DetailPanel>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default AccountsDetailPage
