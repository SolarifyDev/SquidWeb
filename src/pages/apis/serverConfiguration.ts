import { get } from 'utils/request'

export interface ServerConfigurationDto {
  serverUrl: string
  commsUrl: string
  serverThumbprint: string
  pollingEnabled: boolean
  pollingPort: number
}

export function getServerConfiguration() {
  return get<ServerConfigurationDto>('/server-configuration')
}
