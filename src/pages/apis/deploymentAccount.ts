import { get, post } from 'utils/request'

export interface DeploymentAccountDto {
  id: number
  spaceId: number
  name: string
  slug: string
  accountType: number
  credentials:
    | TokenCredentialsSummary
    | UsernamePasswordCredentialsSummary
    | ClientCertificateCredentialsSummary
    | AwsCredentialsSummary
    | SshKeyPairCredentialsSummary
    | AzureServicePrincipalCredentialsSummary
    | null
}

export interface TokenCredentialsSummary {
  tokenHasValue: boolean
}

export interface UsernamePasswordCredentialsSummary {
  username: string
  passwordHasValue: boolean
}

export interface ClientCertificateCredentialsSummary {
  certificateDataHasValue: boolean
  certificateKeyDataHasValue: boolean
}

export interface AwsCredentialsSummary {
  accessKey: string
  secretKeyHasValue: boolean
}

export interface SshKeyPairCredentialsSummary {
  username: string
  privateKeyFileHasValue: boolean
}

export interface AzureServicePrincipalCredentialsSummary {
  subscriptionNumber: string
  clientId: string
  tenantId: string
  keyHasValue: boolean
}

export interface CreateDeploymentAccountCommand {
  spaceId: number
  name: string
  accountType: number
  token?: string
  username?: string
  password?: string
  clientCertificateData?: string
  clientCertificateKeyData?: string
  accessKey?: string
  secretKey?: string
}

export interface GetDeploymentAccountsRequest {
  pageIndex?: number
  pageSize?: number
  spaceId?: number
}

export interface GetDeploymentAccountsResponseData {
  count: number
  deploymentAccounts: DeploymentAccountDto[]
}

export function createDeploymentAccount(command: CreateDeploymentAccountCommand) {
  return post<{ deploymentAccount: DeploymentAccountDto }>('/deployment-accounts/create', command)
    .then((res) => res.deploymentAccount)
}

export function getDeploymentAccounts(params?: GetDeploymentAccountsRequest) {
  const query = {
    pageIndex: params?.pageIndex ?? 1,
    pageSize: params?.pageSize ?? 1000,
    ...(params?.spaceId ? { spaceId: params.spaceId } : {}),
  }

  return get<GetDeploymentAccountsResponseData>('/deployment-accounts/list', { params: query })
}
