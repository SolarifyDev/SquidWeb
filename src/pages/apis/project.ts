import { get, post, type RequestConfig } from 'utils/request'

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
  includedLibraryVariableSetIds: number[]
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

export function getProjects(params?: GetProjectsRequest, config?: RequestConfig) {
  const query = {
    pageIndex: params?.pageIndex ?? 1,
    pageSize: params?.pageSize ?? 50,
    ...(params?.keyword ? { keyword: params.keyword } : {}),
    ...(params?.spaceId ? { spaceId: params.spaceId } : {}),
  }

  return get<GetProjectsResponseData>('/projects/list', { params: query, ...config })
}

export function getProject(id: number) {
  return get<ProjectDto>(`/projects/detail/${id}`)
}

export interface GetProjectSummariesRequest {
  projectGroupIds?: number[]
  projectIds?: number[]
  environmentIds?: number[]
  spaceId?: number
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
  deploymentId?: number | null
  channelId?: number | null
  channelName?: string | null
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
      const source = (query ?? {}) as Record<string, unknown>

      Object.entries(source).forEach(([key, value]) => {
        if (value == null) return
        if (Array.isArray(value)) {
          value.forEach((item) => {
            if (item != null) searchParams.append(key, String(item))
          })
          return
        }
        searchParams.append(key, String(value))
      })

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
  id: number
  project: ProjectDto
}

type ProjectUpdatedListener = (project: ProjectDto) => void
const projectUpdatedListeners = new Set<ProjectUpdatedListener>()

export function subscribeProjectUpdated(listener: ProjectUpdatedListener) {
  projectUpdatedListeners.add(listener)
  return () => {
    projectUpdatedListeners.delete(listener)
  }
}

export async function updateProject(command: UpdateProjectCommand) {
  const updatedProject = await post<ProjectDto>('/projects/update', command)
  for (const listener of projectUpdatedListeners) listener(updatedProject)
  return updatedProject
}

export interface DeleteProjectsCommand {
  ids: number[]
  spaceId?: number
}

export interface DeleteProjectsResponseData {
  failIds: number[]
}

export function deleteProjects(command: DeleteProjectsCommand) {
  return post<DeleteProjectsResponseData>('/projects/delete', command)
}
