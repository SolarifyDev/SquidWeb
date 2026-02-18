import { get } from 'utils/request'

export interface LifecycleDto {
  id: number
  name: string
  slug: string
  description: string
  spaceId: number
  json: string
  lastModifiedOn: string | null
  lastModifiedBy: string
}

export interface GetLifecyclesResponseData {
  count: number
  lifecycles: LifecycleDto[]
}

export function getLifecycles() {
  return get<GetLifecyclesResponseData>('/lifecycle')
}
