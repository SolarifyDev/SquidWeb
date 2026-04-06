import { axiosInstance, post } from 'utils/request'
import { getAuthToken, handleUnauthorizedSession } from 'utils/auth'

export interface OpenClawChatMessageDto {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenClawDirectChatRequest {
  spaceId: number
  targetTags?: string[] | null
  messages: OpenClawChatMessageDto[]
  model?: string
  stream?: boolean
  temperature?: number | null
  maxTokens?: number | null
  responseFormat?: string | null
  user?: string | null
  modelOverride?: string | null
  agentId?: string | null
  channel?: string | null
  sessionKey?: string | null
  timeoutSeconds?: number
}

export interface OpenClawDirectChatResult {
  machineId: number
  machineName: string | null
  succeeded: boolean
  content: string | null
  model: string | null
  finishReason: string | null
  error: string | null
}

export interface OpenClawDirectChatResponseData {
  results: OpenClawDirectChatResult[]
}

export interface OpenClawDirectChatStreamEvent {
  machineId?: number
  machineName?: string | null
  delta?: string | null
  model?: string | null
  finishReason?: string | null
  error?: string | null
}

interface OpenClawDirectChatStreamOptions {
  signal?: AbortSignal
  onEvent: (event: OpenClawDirectChatStreamEvent) => void
}

function buildOpenClawChatUrl() {
  return axiosInstance.getUri({ url: '/chat/openclaw' })
}

function resolveNonStreamingTimeoutMs(timeoutSeconds?: number) {
  const parsed = Number(timeoutSeconds)
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined
  return Math.ceil(parsed * 1000)
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function pickField(source: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) return source[key]
  }
  return undefined
}

function toOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function normalizeStreamEvent(rawPayload: unknown): OpenClawDirectChatStreamEvent | null {
  if (!isRecord(rawPayload)) return null

  const nested = pickField(rawPayload, ['data', 'Data'])
  const source = isRecord(nested) ? nested : rawPayload

  const event: OpenClawDirectChatStreamEvent = {
    machineId: toOptionalNumber(pickField(source, ['machineId', 'MachineId', 'machine_id'])),
    machineName: toOptionalString(pickField(source, ['machineName', 'MachineName', 'machine_name'])),
    delta: toOptionalString(pickField(source, ['delta', 'Delta', 'content', 'Content'])),
    model: toOptionalString(pickField(source, ['model', 'Model'])),
    finishReason: toOptionalString(pickField(source, ['finishReason', 'FinishReason', 'finish_reason'])),
    error: toOptionalString(pickField(source, ['error', 'Error'])),
  }

  const hasAnyMeaningfulField = event.machineId !== undefined
    || Boolean(event.machineName)
    || Boolean(event.delta)
    || Boolean(event.model)
    || Boolean(event.finishReason)
    || Boolean(event.error)

  return hasAnyMeaningfulField ? event : null
}

export function runOpenClawDirectChat(command: OpenClawDirectChatRequest) {
  const timeoutMs = resolveNonStreamingTimeoutMs(command.timeoutSeconds)
  return post<OpenClawDirectChatResponseData>('/chat/openclaw', {
    ...command,
    stream: false,
  }, timeoutMs ? { timeout: timeoutMs } : undefined)
}

export async function streamOpenClawDirectChat(
  command: OpenClawDirectChatRequest,
  options: OpenClawDirectChatStreamOptions,
) {
  const token = getAuthToken()
  const response = await fetch(buildOpenClawChatUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      ...command,
      stream: true,
    }),
    signal: options.signal,
  })

  if (response.status === 401) {
    handleUnauthorizedSession()
    return
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => '')
    throw new Error(raw || `Request failed (${response.status})`)
  }

  if (!response.body) {
    throw new Error('Streaming response body is empty.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const flushEventBlock = (block: string) => {
    const lines = block.split(/\r?\n/)
    const dataLines: string[] = []
    lines.forEach((line) => {
      if (!line.startsWith('data:')) return
      dataLines.push(line.slice(5).trimStart())
    })
    if (dataLines.length === 0) return false

    const payload = dataLines.join('\n')
    if (!payload || payload === '[DONE]') return true

    try {
      const normalized = normalizeStreamEvent(JSON.parse(payload))
      if (normalized) options.onEvent(normalized)
    } catch {
      // Some SSE servers emit one JSON payload per `data:` line without proper blank line separator.
      // Try to parse each line independently before discarding the block.
      for (const linePayload of dataLines) {
        if (!linePayload || linePayload === '[DONE]') continue
        try {
          const normalized = normalizeStreamEvent(JSON.parse(linePayload))
          if (normalized) options.onEvent(normalized)
        } catch {
          // Ignore malformed chunks and continue reading stream.
        }
      }
    }
    return false
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() ?? ''

    for (const block of blocks) {
      const isDone = flushEventBlock(block)
      if (isDone) return
    }
  }

  if (buffer.trim()) {
    flushEventBlock(buffer.trim())
  }
}
