import { get, post } from 'utils/request'

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
}

export interface GetProjectsResponseData {
  count: number
  projects: ProjectDto[]
}

export function getProjects(params?: GetProjectsRequest) {
  const query = {
    pageIndex: params?.pageIndex ?? 1,
    pageSize: params?.pageSize ?? 50,
    ...(params?.keyword ? { keyword: params.keyword } : {}),
  }

  return get<GetProjectsResponseData>('/projects/list', { params: query })
}

export function getProject(id: number) {
  return get<ProjectDto>(`/projects/detail/${id}`)
}

export interface GetProjectSummariesRequest {
  projectGroupIds?: number[]
  projectIds?: number[]
  environmentIds?: number[]
}

export interface ProjectDashboardEnvironment {
  id: number
  name: string
}

export type ProjectDashboardState =
  | 'Success'
  | 'Failed'
  | 'Executing'
  | 'Pending'
  | 'Cancelled'
  | 'TimedOut'
  | 'Cancelling'

export interface ProjectDashboardItem {
  projectId: number
  environmentId: number
  releaseVersion: string
  state: ProjectDashboardState | string
  completedTime: string | null
  hasWarningsOrErrors: boolean
}

export interface ProjectSummaryProject {
  id: number
  name: string
  slug: string
  isDisabled: boolean
  projectGroupId: number
}

export interface ProjectGroupSummary {
  id: number
  name: string
  description: string
  slug: string
  projects: ProjectSummaryProject[]
  environmentIds: number[]
}

export interface GetProjectSummariesResponseData {
  groups: ProjectGroupSummary[]
  environments: ProjectDashboardEnvironment[]
  items: ProjectDashboardItem[]
}

export function getProjectSummaries(params?: GetProjectSummariesRequest) {
  return get<GetProjectSummariesResponseData>('/projects/summaries', {
    params,
    paramsSerializer: (query) => {
      const searchParams = new URLSearchParams()
      const source = query as GetProjectSummariesRequest | undefined
      source?.projectGroupIds?.forEach((id) => searchParams.append('projectGroupIds', String(id)))
      source?.projectIds?.forEach((id) => searchParams.append('projectIds', String(id)))
      source?.environmentIds?.forEach((id) => searchParams.append('environmentIds', String(id)))
      return searchParams.toString()
    },
  })
}

export interface CreateProjectCommand {
  project: ProjectDto
}

export function createProject(command: CreateProjectCommand) {
  return post<ProjectDto>('/projects/create', command)
}

export interface UpdateProjectCommand {
  project: ProjectDto
}

export function updateProject(command: UpdateProjectCommand) {
  return post<ProjectDto>('/projects/update', command)
}

export interface DeleteProjectsCommand {
  ids: number[]
}

export interface DeleteProjectsResponseData {
  failIds: number[]
}

export function deleteProjects(command: DeleteProjectsCommand) {
  return post<DeleteProjectsResponseData>('/projects/delete', command)
}
