import { get, post, type RequestConfig } from 'utils/request'

export interface ProjectGroupDto {
  id: number
  name: string
  description: string
  spaceId: number
  slug: string
  dataVersion?: number[] | null
}

export interface GetProjectGroupsRequest {
  pageIndex?: number
  pageSize?: number
  spaceId?: number
}

export interface GetProjectGroupsResponseData {
  count: number
  projectGroups: ProjectGroupDto[]
}

export function getProjectGroups(params?: GetProjectGroupsRequest, config?: RequestConfig) {
  const query = {
    pageIndex: params?.pageIndex ?? 1,
    pageSize: params?.pageSize ?? 1000,
    ...(params?.spaceId ? { spaceId: params.spaceId } : {}),
  }

  return get<GetProjectGroupsResponseData>('/project-groups/list', { params: query, ...config })
}

export interface CreateProjectGroupCommand {
  projectGroup: ProjectGroupDto
}

export function createProjectGroup(command: CreateProjectGroupCommand) {
  return post<ProjectGroupDto>('/project-groups/create', command)
}

export interface UpdateProjectGroupCommand {
  projectGroup: ProjectGroupDto
}

export function updateProjectGroup(command: UpdateProjectGroupCommand) {
  return post<ProjectGroupDto>('/project-groups/update', command)
}

export interface DeleteProjectGroupsCommand {
  ids: number[]
}

export interface DeleteProjectGroupsResponseData {
  failIds: number[]
}

export function deleteProjectGroups(command: DeleteProjectGroupsCommand) {
  return post<DeleteProjectGroupsResponseData>('/project-groups/delete', command)
}
