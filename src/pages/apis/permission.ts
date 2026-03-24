import { get } from 'utils/request'

export type PermissionScope = 'SystemOnly' | 'SpaceOnly' | 'Mixed'

export interface PermissionDefinitionDto {
  name: string
  scope: PermissionScope | string
}

export interface MyPermissionsDto {
  userId: number
  permissions: string[]
}

export function getAllPermissions() {
  return get<PermissionDefinitionDto[]>('/permissions/all')
}

export function getMyPermissions() {
  return get<MyPermissionsDto>('/permissions/me')
}
