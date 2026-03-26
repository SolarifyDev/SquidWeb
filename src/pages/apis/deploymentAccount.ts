import { get, post } from 'utils/request'

export enum DeploymentAccountType {
  UsernamePassword = 1,
  SshKeyPair = 2,
  Token = 3,
  AzureSubscription = 4,
  AzureServicePrincipal = 5,
  AmazonWebServicesAccount = 6,
  AmazonWebServicesRoleAccount = 7,
  ClientCertificate = 8,
  AzureOidc = 9,
  GoogleCloudAccount = 10,
  AmazonWebServicesOidcAccount = 11,
}

export interface DeploymentAccountDto {
  id: number
  spaceId: number
  name: string
  slug: string
  accountType: number
  description?: string | null
  environmentIds?: number[] | null
  credentials:
    | TokenCredentialsSummary
    | UsernamePasswordCredentialsSummary
    | ClientCertificateCredentialsSummary
    | AwsCredentialsSummary
    | SshKeyPairCredentialsSummary
    | AzureServicePrincipalCredentialsSummary
    | AzureOidcCredentialsSummary
    | GcpCredentialsSummary
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
  passphraseHasValue: boolean
}

export interface AzureServicePrincipalCredentialsSummary {
  subscriptionNumber: string
  clientId: string
  tenantId: string
  keyHasValue: boolean
}

export interface AzureOidcCredentialsSummary {
  subscriptionNumber: string
  clientId: string
  tenantId: string
  jwtHasValue: boolean
}

export interface GcpCredentialsSummary {
  jsonKeyHasValue: boolean
}

export interface UsernamePasswordCredentials {
  username: string
  password: string
}

export interface SshKeyPairCredentials {
  username: string
  privateKeyFile: string
  privateKeyPassphrase?: string
}

export interface TokenCredentials {
  token: string
}

export interface AzureServicePrincipalCredentials {
  subscriptionNumber: string
  clientId: string
  tenantId: string
  key: string
}

export interface AmazonWebServicesCredentials {
  accessKey: string
  secretKey: string
}

export interface AmazonWebServicesRoleCredentials {
  accessKey: string
  secretKey: string
  roleArn: string
  sessionDuration: string
  externalId?: string
}

export interface ClientCertificateCredentials {
  clientCertificateData: string
  clientCertificateKeyData: string
}

export interface AzureOidcCredentials {
  subscriptionNumber: string
  clientId: string
  tenantId: string
  jwt: string
}

export interface GoogleCloudCredentials {
  jsonKey: string
}

export interface AmazonWebServicesOidcCredentials {
  roleArn: string
  webIdentityToken: string
}

export type DeploymentAccountCredentials =
  | UsernamePasswordCredentials
  | SshKeyPairCredentials
  | TokenCredentials
  | AzureServicePrincipalCredentials
  | AmazonWebServicesCredentials
  | AmazonWebServicesRoleCredentials
  | ClientCertificateCredentials
  | AzureOidcCredentials
  | GoogleCloudCredentials
  | AmazonWebServicesOidcCredentials

export interface CreateDeploymentAccountCommand {
  spaceId: number
  name: string
  accountType: number
  credentials: DeploymentAccountCredentials | null
  description?: string
  environmentIds?: number[]
}

export interface UpdateDeploymentAccountCommand extends CreateDeploymentAccountCommand {
  id: number
}

export interface DeleteDeploymentAccountCommand {
  spaceId: number
  id?: number
  ids?: number[]
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

export function updateDeploymentAccount(command: UpdateDeploymentAccountCommand) {
  return post<{ deploymentAccount: DeploymentAccountDto }>('/deployment-accounts/update', command)
    .then((res) => res.deploymentAccount)
}

export function deleteDeploymentAccount(command: DeleteDeploymentAccountCommand) {
  const resolvedId = command.id ?? command.ids?.[0]
  if (resolvedId == null) {
    throw new Error('Delete deployment account requires an id')
  }

  return post<unknown>('/deployment-accounts/delete', {
    ...command,
    id: resolvedId,
    ids: command.ids ?? [resolvedId],
  })
}

export function getDeploymentAccounts(params?: GetDeploymentAccountsRequest) {
  const query = {
    pageIndex: params?.pageIndex ?? 1,
    pageSize: params?.pageSize ?? 1000,
    ...(params?.spaceId ? { spaceId: params.spaceId } : {}),
  }

  return get<GetDeploymentAccountsResponseData>('/deployment-accounts/list', { params: query })
}
