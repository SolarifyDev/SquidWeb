import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios'
import type { LoadingStats } from './loadingProgress'
import { getAuthToken, handleUnauthorizedSession, isAuthenticated } from 'utils/auth'
import { resolveApiBaseUrl } from 'utils/apiBase'

const API_BASE_URL = resolveApiBaseUrl()
const CURRENT_SPACE_ID_KEY = 'CURRENT_SPACE_ID'
const SPACE_ID_HEADER = 'X-Space-Id'
const SPACE_ROUTE_PATTERN = /^\/Spaces-(\d+)(?:\/|$)/i
const SPACE_ID_PARAM = 'spaceId'

// 创建 axios 实例
const instance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
})

// 进行中的请求计数 + 订阅（供顶部进度条等全局 loading 指示使用）
// Cumulative request telemetry for the top progress bar. `started`/`settled` never reset, so a
// subscriber can take its own baseline and derive real per-navigation progress; `inFlight` alone
// cannot do that, because it returns to zero between a page's request waves.
const inFlightStats: LoadingStats = { inFlight: 0, started: 0, settled: 0 }
type InFlightListener = (stats: LoadingStats) => void
const inFlightListeners = new Set<InFlightListener>()

/** Marks a config we actually counted, so start and settle stay symmetric by construction. */
const COUNTED_FLAG = '__squidLoadingCounted'

function emitInFlight() {
  const snapshot = { ...inFlightStats }
  for (const listener of inFlightListeners) listener(snapshot)
}

function notifyRequestStarted() {
  inFlightStats.inFlight += 1
  inFlightStats.started += 1
  emitInFlight()
}

function notifyRequestSettled() {
  inFlightStats.inFlight = Math.max(0, inFlightStats.inFlight - 1)
  inFlightStats.settled += 1
  emitInFlight()
}

export function subscribeInFlight(listener: InFlightListener) {
  inFlightListeners.add(listener)
  listener({ ...inFlightStats })
  return () => {
    inFlightListeners.delete(listener)
  }
}

function readPersistedSpaceId() {
  try {
    const raw = window.localStorage.getItem(CURRENT_SPACE_ID_KEY)
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}

function persistSpaceId(spaceId: number) {
  try {
    window.localStorage.setItem(CURRENT_SPACE_ID_KEY, String(spaceId))
  } catch {
    // ignore storage failures
  }
}

function getCurrentSpaceId() {
  try {
    const hash = window.location.hash || ''
    const hashPath = hash.startsWith('#') ? hash.slice(1).split('?')[0] : ''
    const pathname = hashPath || window.location.pathname || ''
    const match = pathname.match(SPACE_ROUTE_PATTERN)
    if (match) {
      const parsed = Number(match[1])
      if (Number.isFinite(parsed) && parsed > 0) {
        persistSpaceId(parsed)
        return parsed
      }
    }
    return readPersistedSpaceId()
  } catch {
    return null
  }
}

function extractApiPath(url?: string) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url)
      return parsed.pathname
    } catch {
      return url
    }
  }
  const [pathname] = url.split('?')
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

function normalizeApiPath(url?: string) {
  const path = extractApiPath(url)
  if (!path) return ''
  return path.startsWith('/api/') ? path.slice(4) : path
}

function isSystemScopedApiPath(path: string) {
  if (!path) return true
  if (path.startsWith('/spaces') || path.startsWith('/space')) return true
  if (path.startsWith('/users')) return true
  if (path.startsWith('/userroles') || path.startsWith('/user-roles')) return true
  if (path.startsWith('/teams')) return true
  if (path === '/package-stores' || path.startsWith('/package-stores/')) return true
  if (path.startsWith('/permissions')) return true
  if (path.startsWith('/auth')) return true
  if (/^\/tasks(?:\/)?$/.test(path)) return true
  if (/^\/tasks\/\d+\/interruptions(?:\/)?$/i.test(path)) return false
  if (path.startsWith('/tasks/')) return true
  return false
}

function shouldInjectSpaceId(path: string) {
  return !isSystemScopedApiPath(path)
}

function appendSpaceIdToBody(data: unknown, spaceId: number) {
  if (data == null) return { [SPACE_ID_PARAM]: spaceId }
  if (data instanceof FormData || data instanceof URLSearchParams) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    const nextBody = data as Record<string, unknown>
    if (nextBody[SPACE_ID_PARAM] != null) return nextBody
    return { ...nextBody, [SPACE_ID_PARAM]: spaceId }
  }
  return data
}

// 请求拦截：自动注入 token
instance.interceptors.request.use(
  (config) => {
    const token = isAuthenticated() ? getAuthToken() : null

    if (token) {
      if (!config.headers) {
        config.headers = {} as any
      }
      ;(config.headers as any).Authorization = `Bearer ${token}`
    }

    const method = String(config.method ?? 'get').toLowerCase()
    const path = normalizeApiPath(config.url)
    const currentSpaceId = getCurrentSpaceId()

    if (currentSpaceId != null) {
      if (!config.headers) {
        config.headers = {} as any
      }
      ;(config.headers as any)[SPACE_ID_HEADER] = String(currentSpaceId)
    }

    if (
      currentSpaceId != null
      && shouldInjectSpaceId(path)
      && !(config as RequestConfig).skipSpaceIdInjection
      && (method === 'post' || method === 'put' || method === 'patch')
    ) {
      config.data = appendSpaceIdToBody(config.data, currentSpaceId)
    }

    if (!(config as any).silentLoading) {
      ;(config as any)[COUNTED_FLAG] = true
      notifyRequestStarted()
    }

    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  },
)

// 响应拦截：目前只透传错误，你可以在这里做全局错误提示、401 处理等
instance.interceptors.response.use(
  (response) => {
    if ((response.config as any)?.[COUNTED_FLAG]) notifyRequestSettled()
    return response
  },
  (error: AxiosError) => {
    if ((error.config as any)?.[COUNTED_FLAG]) notifyRequestSettled()
    if (error.response?.status === 401) {
      handleUnauthorizedSession()
    }
    return Promise.reject(error)
  },
)

export interface ApiResponse<T = any> {
  data: T
  msg: string | null
  code: number
}

// 业务错误类型（code 非成功码时抛出）
export class ApiError extends Error {
  code: number
  status?: number
  raw?: unknown

  constructor(message: string, code: number, status?: number, raw?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.raw = raw
  }
}

const SUCCESS_CODES = new Set([0, 200, 202])

export interface RequestConfig<T = any> extends AxiosRequestConfig<T> {
  // When true, this request is excluded from the global in-flight counter
  // (so it won't drive the top progress bar). Use for component-local loading.
  silentLoading?: boolean
  // Some APIs require spaceId only in the route, query, or multipart body.
  skipSpaceIdInjection?: boolean
}

// 统一处理后端 { data, msg, code } 的响应
function handleBusinessResponse<T>(
  res: AxiosResponse<ApiResponse<T>>,
): T {
  const body = res.data
  if (!SUCCESS_CODES.has(body.code)) {
    throw new ApiError(body.msg || 'Request failed', body.code, res.status, body)
  }
  return body.data
}

// 下面这些方法会返回后端真正的 data（而不是 AxiosResponse 或 {data,msg,code}）
export async function get<T = any>(
  url: string,
  config?: RequestConfig,
): Promise<T> {
  const res: AxiosResponse<ApiResponse<T>> = await instance.get(url, config)
  return handleBusinessResponse(res)
}

export async function post<T = any, D = any>(
  url: string,
  data?: D,
  config?: RequestConfig<D>,
): Promise<T> {
  const res: AxiosResponse<ApiResponse<T>> = await instance.post(url, data, config)
  return handleBusinessResponse(res)
}

export async function put<T = any, D = any>(
  url: string,
  data?: D,
  config?: RequestConfig<D>,
): Promise<T> {
  const res: AxiosResponse<ApiResponse<T>> = await instance.put(url, data, config)
  return handleBusinessResponse(res)
}

export async function del<T = any>(
  url: string,
  config?: RequestConfig,
): Promise<T> {
  const res: AxiosResponse<ApiResponse<T>> = await instance.delete(url, config)
  return handleBusinessResponse(res)
}

// 如果你有更复杂的场景，可以直接使用这个 axios 实例
export { instance as axiosInstance }

// 默认导出一个简单对象，方便按需解构
export default {
  get,
  post,
  put,
  delete: del,
}
