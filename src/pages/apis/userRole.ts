import { get, post } from 'utils/request'

export interface UserRoleDto {
  id: number
  name: string
  description: string
  isBuiltIn: boolean
  permissions: string[]
  canApplyAtSpaceLevel: boolean
  canApplyAtSystemLevel: boolean
}

export interface CreateUserRoleCommand {
  name: string
  description: string
  permissions: string[]
}

export interface UpdateUserRoleCommand {
  id: number
  name: string
  description: string
  permissions: string[]
}

export interface DeleteUserRoleCommand {
  id: number
}

export function getUserRoles() {
  return get<UserRoleDto[]>('/userroles/list')
}

export function getUserRole(id: number) {
  return get<UserRoleDto>(`/userroles/${id}`)
}

export function createUserRole(command: CreateUserRoleCommand) {
  return post<UserRoleDto, CreateUserRoleCommand>('/userroles/create', command)
}

export function updateUserRole(command: UpdateUserRoleCommand) {
  return post<UserRoleDto, UpdateUserRoleCommand>('/userroles/update', command)
}

export function deleteUserRole(command: DeleteUserRoleCommand) {
  return post<void, DeleteUserRoleCommand>('/userroles/delete', command)
}
