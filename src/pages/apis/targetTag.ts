import { get, post } from 'utils/request'

export interface TargetTagDto {
  id: number
  name: string
  spaceId: number
}

export interface GetTargetTagsResponseData {
  targetTags: TargetTagDto[]
}

export function getTargetTags() {
  return get<GetTargetTagsResponseData>('/target-tags/list')
}

export interface CreateTargetTagCommand {
  name: string
  spaceId: number
}

export function createTargetTag(command: CreateTargetTagCommand) {
  return post<{ targetTag: TargetTagDto }>('/target-tags/create', command)
    .then((res) => res.targetTag)
}

