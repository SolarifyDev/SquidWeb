import { get, post, put, del } from 'utils/request'

// 对应后端 ProjectDto
export interface ProjectDto {
  id: number
  name: string
  slug: string | null
  isDisabled: boolean
  variableSetId: number
  deploymentProcessId: number
  projectGroupId: number
  lifecycleId: number
  autoCreateRelease: boolean
  json: string | null
  includedLibraryVariableSetIds: string | null
  discreteChannelRelease: boolean
  dataVersion: string | null
  clonedFromProjectId: number | null
  spaceId: number
  lastModified: string
  allowIgnoreChannelRules: boolean
}

// 获取项目列表
export interface GetProjectsRequest {
  pageIndex?: number
  pageSize?: number
  keyword?: string
}

export interface GetProjectsResponseData {
  count: number
  projects: ProjectDto[]
}

export function GetProjects(params?: GetProjectsRequest) {
  return get<GetProjectsResponseData>('/Project', { params })
}

// 获取单个项目
// 后端响应结构为 { msg, code, data: ProjectDto }，这里直接返回 ProjectDto
export function GetProject(id: number) {
  return get<ProjectDto>(`/Project/${id}`)
}

// 创建项目
export interface CreateProjectPayload {
  name: string | null
  slug: string | null
  isDisabled: boolean
  projectGroupId: number
  lifecycleId: number
  autoCreateRelease: boolean
  json: string | null
  includedLibraryVariableSetIds: string | null
  discreteChannelRelease: boolean
  spaceId: number
  allowIgnoreChannelRules: boolean
}

export interface CreateProjectCommand {
  project: CreateProjectPayload
}

export function CreateProject(command: CreateProjectCommand) {
  return post<ProjectDto, CreateProjectCommand>('/Project', command)
}

// 更新项目
export interface UpdateProjectCommand {
  project: ProjectDto
}

export function UpdateProject(command: UpdateProjectCommand) {
  return put<ProjectDto, UpdateProjectCommand>('/Project', command)
}

// 删除项目（批量）
export interface DeleteProjectsCommand {
  ids: number[]
}

export interface DeleteProjectsResponseData {
  failIds: number[]
}

export function DeleteProjects(command: DeleteProjectsCommand) {
  return del<DeleteProjectsResponseData>('/Project', { data: command })
}
