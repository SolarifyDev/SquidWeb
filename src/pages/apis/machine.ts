import { get, post, put, del } from 'utils/request'

export enum OperatingSystemType {
  Unknown = 0,
  Windows = 1,
  Linux = 2,
  Mac = 3,
  Other = 4,
}

export interface MachineDto {
  id: number
  name: string | null
  isDisabled: boolean
  roles: string | null
  environmentIds: string | null
  json: string | null
  machinePolicyId: number | null
  thumbprint: string | null
  uri: string | null
  hasLatestCalamari: boolean
  endpoint: string | null
  dataVersion: string | null
  spaceId: number
  operatingSystem: OperatingSystemType
  shellName: string | null
  shellVersion: string | null
  licenseHash: string | null
  slug: string | null
}

export interface GetMachinesRequest {
  pageIndex?: number
  pageSize?: number
}

export interface GetMachinesResponseData {
  count: number
  machines: MachineDto[]
}

export function GetMachines(params?: GetMachinesRequest) {
  return get<GetMachinesResponseData>('/Machine', { params })
}

export interface CreateMachineCommand {
  name: string | null
  isDisabled: boolean
  roles: string | null
  environmentIds: string | null
  json: string | null
  machinePolicyId: number | null
  thumbprint: string | null
  uri: string | null
  hasLatestCalamari: boolean
  endpoint: string | null
  spaceId: number
  operatingSystem: string | null
  shellName: string | null
  shellVersion: string | null
  licenseHash: string | null
  slug: string | null
}

export interface CreateMachineResponseData {
  machine: MachineDto
}

export function CreateMachine(command: CreateMachineCommand) {
  return post<CreateMachineResponseData, CreateMachineCommand>('/Machine', command)
}

export interface UpdateMachineCommand {
  id: number
  name: string | null
  isDisabled: boolean
  roles: string | null
  environmentIds: string | null
  json: string | null
  machinePolicyId: number | null
  thumbprint: string | null
  uri: string | null
  hasLatestCalamari: boolean
  endpoint: string | null
  spaceId: number
  operatingSystem: string | null
  shellName: string | null
  shellVersion: string | null
  licenseHash: string | null
  slug: string | null
}

export interface UpdateMachineResponseData {
  machine: MachineDto
}

export function UpdateMachine(command: UpdateMachineCommand) {
  return put<UpdateMachineResponseData, UpdateMachineCommand>('/Machine', command)
}

export interface DeleteMachinesCommand {
  ids: number[]
}

export interface DeleteMachinesResponseData {
  failIds: number[]
}

export function DeleteMachines(command: DeleteMachinesCommand) {
  return del<DeleteMachinesResponseData>('/Machine', { data: command })
}
