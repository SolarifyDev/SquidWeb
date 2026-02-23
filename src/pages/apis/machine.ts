import { get } from 'utils/request'

export interface MachineDto {
  id: number
  name: string
  isDisabled: boolean
  roles: string
  environmentIds: string
  json: string
  machinePolicyId: number | null
  thumbprint: string
  uri: string
  hasLatestCalamari: boolean
  endpoint: string
  spaceId: number
  operatingSystem: string
  shellName: string
  shellVersion: string
  slug: string
}

export interface GetMachinesRequest {
  pageIndex?: number
  pageSize?: number
  spaceId?: number
}

export interface GetMachinesResponseData {
  count: number
  machines: MachineDto[]
}

export function getMachines(params?: GetMachinesRequest) {
  return get<GetMachinesResponseData>('/machine', { params })
}
