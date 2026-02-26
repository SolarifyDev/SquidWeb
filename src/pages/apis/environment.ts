import { get, post } from 'utils/request'

export interface EnvironmentDto {
  id: number
  spaceId: number
  slug: string
  name: string
  description: string
  sortOrder: number
  useGuidedFailure: boolean
  allowDynamicInfrastructure: boolean
  lastModifiedOn: string | null
  lastModifiedBy: string
}

export interface GetEnvironmentsRequest {
  pageIndex?: number
  pageSize?: number
  spaceId?: number
}

export interface GetEnvironmentsResponseData {
  count: number
  environments: EnvironmentDto[]
}

export function getEnvironments(params?: GetEnvironmentsRequest) {
  const query = {
    pageIndex: params?.pageIndex ?? 1,
    pageSize: params?.pageSize ?? 1000,
    ...(params?.spaceId ? { spaceId: params.spaceId } : {}),
  }

  return get<GetEnvironmentsResponseData>('/environments/list', { params: query })
}

export interface CreateEnvironmentCommand {
  spaceId: number
  slug: string
  name: string
  description: string
  sortOrder: number
  useGuidedFailure: boolean
  allowDynamicInfrastructure: boolean
}

export function createEnvironment(command: CreateEnvironmentCommand) {
  return post<{ environment: EnvironmentDto }>('/environments/create', command)
    .then((res) => res.environment)
}
