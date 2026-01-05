import { get, post, put, del } from 'utils/request'

export interface EnvironmentDto {
  id: number
  spaceId: number
  slug: string | null
  name: string | null
  description: string | null
  sortOrder: number
  useGuidedFailure: boolean
  allowDynamicInfrastructure: boolean
  lastModifiedOn: string | null
  lastModifiedBy: string | null
}

export interface GetEnvironmentsRequest {
  pageIndex?: number
  pageSize?: number
}

export interface GetEnvironmentsResponseData {
  count: number
  environments: EnvironmentDto[]
}

export function GetEnvironments(params?: GetEnvironmentsRequest) {
  return get<GetEnvironmentsResponseData>('/Environment', { params })
}

export interface CreateEnvironmentCommand {
  spaceId: number
  slug: string | null
  name: string | null
  description: string | null
  sortOrder: number
  useGuidedFailure: boolean
  allowDynamicInfrastructure: boolean
}

export interface CreateEnvironmentResponseData {
  environment: EnvironmentDto
}

export function CreateEnvironment(command: CreateEnvironmentCommand) {
  return post<CreateEnvironmentResponseData, CreateEnvironmentCommand>('/Environment', command)
}

export interface UpdateEnvironmentCommand {
  id: number
  spaceId: number
  slug: string | null
  name: string | null
  description: string | null
  sortOrder: number
  useGuidedFailure: boolean
  allowDynamicInfrastructure: boolean
}

export interface UpdateEnvironmentResponseData {
  environment: EnvironmentDto
}

export function UpdateEnvironment(command: UpdateEnvironmentCommand) {
  return put<UpdateEnvironmentResponseData, UpdateEnvironmentCommand>('/Environment', command)
}

export interface DeleteEnvironmentsCommand {
  ids: number[]
}

export interface DeleteEnvironmentsResponseData {
  failIds: number[]
}

export function DeleteEnvironments(command: DeleteEnvironmentsCommand) {
  return del<DeleteEnvironmentsResponseData>('/Environment', { data: command })
}
