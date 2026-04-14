import { axiosInstance, type ApiResponse } from 'utils/request'

export interface ServerConfigurationDto {
  serverUrl: string
  commsUrl: string
  serverThumbprint: string
  pollingEnabled: boolean
  pollingPort: number
}

function normalizeServerConfiguration(payload: Record<string, unknown>): ServerConfigurationDto {
  return {
    serverUrl: String(payload.serverUrl ?? payload.ServerUrl ?? ''),
    commsUrl: String(payload.commsUrl ?? payload.CommsUrl ?? ''),
    serverThumbprint: String(payload.serverThumbprint ?? payload.ServerThumbprint ?? ''),
    pollingEnabled: Boolean(payload.pollingEnabled ?? payload.PollingEnabled ?? false),
    pollingPort: Number(payload.pollingPort ?? payload.PollingPort ?? 0),
  }
}

export async function getServerConfiguration(): Promise<ServerConfigurationDto> {
  const res = await axiosInstance.get<ApiResponse<ServerConfigurationDto> | ServerConfigurationDto>('/server-configuration')
  const raw = res.data as unknown
  if (raw && typeof raw === 'object' && 'code' in (raw as Record<string, unknown>)) {
    const wrapped = raw as Record<string, unknown>
    const code = Number(wrapped.code ?? wrapped.Code ?? 0)
    if (code !== 200) throw new Error(String(wrapped.msg ?? wrapped.Msg ?? 'Failed to load server configuration'))
    const wrappedData = wrapped.data ?? wrapped.Data
    if (!wrappedData || typeof wrappedData !== 'object') return normalizeServerConfiguration({})
    return normalizeServerConfiguration(wrappedData as Record<string, unknown>)
  }

  if (!raw || typeof raw !== 'object') return normalizeServerConfiguration({})
  return normalizeServerConfiguration(raw as Record<string, unknown>)
}
