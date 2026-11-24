import axios, { AxiosError, type Method } from 'axios'
import { getAuthToken, handleUnauthorizedSession } from 'utils/auth'
import { ApiError, type ApiResponse } from 'utils/request'
import { resolveAuthBaseUrl } from 'utils/apiBase'

export interface LoginRequestDto {
  userName: string
  password: string
}

export interface UserAccountDto {
  id: number
  userName: string
  displayName: string
  isSystem: boolean
  createdAtUtc: string
}

export interface LoginResponseData {
  accessToken: string
  expiresAtUtc: string
  userAccount: UserAccountDto
  mustChangePassword: boolean
}

export interface CurrentUserDto {
  id: number
  userName: string
  displayName: string
  isSystem: boolean
  emailAddress?: string | null
  createdAtUtc?: string
}

export interface ChangePasswordCommand {
  userId: number
  currentPassword?: string | null
  newPassword: string
}

export interface UpdateUserStatusCommand {
  isDisabled: boolean
}

export interface ApiKeyDto {
  id: number
  description: string
  maskedKey: string
  createdAtUtc: string
}

export interface CreateApiKeyCommand {
  description?: string
}

export interface CreateApiKeyResult {
  apiKey: ApiKeyDto | null
  plainTextKey: string | null
}

const AUTH_BASE_URL = resolveAuthBaseUrl()

const AUTH_SUCCESS_CODE = 200

function buildAuthHeaders(includeJson = true) {
  const token = getAuthToken()
  if (!token) throw new ApiError('Not authenticated', 401)

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  }
  if (includeJson) headers['Content-Type'] = 'application/json'
  return headers
}

function normalizeUserAccount(raw: any): UserAccountDto {
  return {
    id: Number(raw?.id ?? 0),
    userName: String(raw?.userName ?? raw?.username ?? '').trim(),
    displayName: String(raw?.displayName ?? raw?.name ?? raw?.userName ?? '').trim(),
    isSystem: raw?.isSystem === true,
    createdAtUtc: String(raw?.createdAtUtc ?? raw?.createdDate ?? '').trim(),
  }
}

function normalizeCurrentUser(raw: any): CurrentUserDto {
  return {
    id: Number(raw?.id ?? 0),
    userName: String(raw?.userName ?? raw?.username ?? '').trim(),
    displayName: String(raw?.displayName ?? raw?.name ?? raw?.userName ?? '').trim(),
    isSystem: raw?.isSystem === true,
    emailAddress: raw?.emailAddress ?? raw?.email ?? null,
    createdAtUtc: String(raw?.createdAtUtc ?? raw?.createdDate ?? '').trim() || undefined,
  }
}

function toApiKeyDto(raw: any): ApiKeyDto | null {
  const id = Number(raw?.id ?? raw?.apiKeyId)
  if (!Number.isFinite(id) || id <= 0) return null

  return {
    id,
    description: String(raw?.description ?? '').trim(),
    maskedKey: String(
      raw?.maskedKey ??
      raw?.keyMask ??
      raw?.mask ??
      raw?.apiKeyMask ??
      raw?.keyPrefix ??
      '',
    ).trim(),
    createdAtUtc: String(raw?.createdAtUtc ?? raw?.createdDate ?? raw?.createdOn ?? '').trim(),
  }
}

function extractApiKeys(payload: any): ApiKeyDto[] {
  const directArray = Array.isArray(payload) ? payload : null
  const candidates = [
    directArray,
    payload?.items,
    payload?.list,
    payload?.apiKeys,
    payload?.data,
  ]
  const array = candidates.find((entry) => Array.isArray(entry))
  if (!Array.isArray(array)) return []

  const mapped = array.map(toApiKeyDto).filter((item): item is ApiKeyDto => item != null)
  const dedup = new Map<number, ApiKeyDto>()
  for (const item of mapped) dedup.set(item.id, item)
  return Array.from(dedup.values()).sort((left, right) => right.createdAtUtc.localeCompare(left.createdAtUtc))
}

function extractPlainTextApiKey(payload: any) {
  const candidates = [
    payload?.plainTextKey,
    payload?.apiKey,
    payload?.key,
    payload?.token,
    payload?.secret,
  ]
  const match = candidates.find((item) => typeof item === 'string' && item.trim().length > 0)
  return typeof match === 'string' ? match.trim() : null
}

async function requestAuth<T = any, D = any>(
  method: Method,
  path: string,
  data?: D,
  authRequired = true,
): Promise<T> {
  try {
    const res = await axios.request<ApiResponse<T>>({
      method,
      url: `${AUTH_BASE_URL}${path}`,
      data,
      timeout: 15000,
      headers: authRequired ? buildAuthHeaders(method !== 'GET' && method !== 'DELETE') : { 'Content-Type': 'application/json' },
    })

    if (res.data.code !== AUTH_SUCCESS_CODE) {
      throw new ApiError(res.data.msg || 'Request failed', res.data.code, res.status, res.data)
    }

    return res.data.data
  } catch (error) {
    const err = error as AxiosError<any>
    if (err.response?.status === 401) handleUnauthorizedSession()
    if (err.response?.data) {
      const body = err.response.data
      throw new ApiError(
        body.msg || body.message || err.message || 'Request failed',
        Number(body.code ?? err.response.status ?? 500),
        err.response.status,
        body,
      )
    }
    throw error
  }
}

export async function login(request: LoginRequestDto): Promise<LoginResponseData> {
  const data = await requestAuth<LoginResponseData, LoginRequestDto>('POST', '/auth/login', request, false)
  return {
    ...data,
    mustChangePassword: data?.mustChangePassword === true,
    userAccount: normalizeUserAccount(data?.userAccount),
  }
}

export async function getCurrentUser(): Promise<CurrentUserDto> {
  const data = await requestAuth<any>('GET', '/auth/me')
  return normalizeCurrentUser(data?.userAccount ?? data?.user ?? data)
}

export function changePassword(command: ChangePasswordCommand): Promise<void> {
  return requestAuth<void, ChangePasswordCommand>('POST', '/auth/change-password', command)
}

export function updateUserStatus(userId: number, command: UpdateUserStatusCommand): Promise<void> {
  return requestAuth<void, UpdateUserStatusCommand>('POST', `/auth/users/${userId}/status`, command)
}

export async function getApiKeys(): Promise<ApiKeyDto[]> {
  const data = await requestAuth<any>('GET', '/auth/api-keys')
  return extractApiKeys(data)
}

export async function createApiKey(command: CreateApiKeyCommand): Promise<CreateApiKeyResult> {
  const data = await requestAuth<any, CreateApiKeyCommand>('POST', '/auth/api-keys', command)
  return {
    apiKey: toApiKeyDto(data?.apiKey ?? data?.item ?? data),
    plainTextKey: extractPlainTextApiKey(data),
  }
}

export function deleteApiKey(apiKeyId: number): Promise<void> {
  return requestAuth<void>('DELETE', `/auth/api-keys/${apiKeyId}`)
}
