import { get } from 'utils/request'

export interface ProjectDto {
  id: number
  name: string
  slug: string
  isDisabled: boolean
  variableSetId: number
  deploymentProcessId: number
  projectGroupId: number
  lifecycleId: number
  autoCreateRelease: boolean
  json: string
  includedLibraryVariableSetIds: string
  discreteChannelRelease: boolean
  clonedFromProjectId: number | null
  spaceId: number
  lastModified: string
  allowIgnoreChannelRules: boolean
}

export interface GetProjectsRequest {
  pageIndex?: number
  pageSize?: number
  keyword?: string
  spaceId?: number
}

export interface GetProjectsResponseData {
  count: number
  projects: ProjectDto[]
}

export function getProjects(params?: GetProjectsRequest) {
  return get<GetProjectsResponseData>('/project', { params })
}

export function getProject(id: number) {
  return get<ProjectDto>(`/project/${id}`)
}
