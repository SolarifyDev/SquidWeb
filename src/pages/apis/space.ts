import { get } from 'utils/request'

export interface SpaceDto {
  id: number
  name: string
  slug: string
  isDefault: boolean
}

export function getSpaces() {
  return get<SpaceDto[]>('/space')
}
