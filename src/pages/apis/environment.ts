import { get } from 'utils/request'

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
  return get<GetEnvironmentsResponseData>('/environment', { params })
}
