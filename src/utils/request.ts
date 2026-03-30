import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios'
import { getAuthToken, handleUnauthorizedSession, isAuthenticated } from 'utils/auth'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
if (!API_BASE_URL) throw new Error('VITE_API_BASE_URL is required')
const CURRENT_SPACE_ID_KEY = 'CURRENT_SPACE_ID'
const SPACE_ID_HEADER = 'X-Space-Id'
const SPACE_ROUTE_PATTERN = /^\/Spaces-(\d+)(?:\/|$)/i
const SPACE_ID_PARAM = 'spaceId'

// 创建 axios 实例
const instance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
})

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
      && (method === 'post' || method === 'put' || method === 'patch')
    ) {
      config.data = appendSpaceIdToBody(config.data, currentSpaceId)
    }

    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  },
)

// 响应拦截：目前只透传错误，你可以在这里做全局错误提示、401 处理等
instance.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      handleUnauthorizedSession()
    }
    return Promise.reject(error)
  },
)

export interface ApiResponse<T = any> {
  data: T
  msg: string
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

const SUCCESS_CODE = 200

export interface RequestConfig<T = any> extends AxiosRequestConfig<T> {}

// 统一处理后端 { data, msg, code } 的响应
function handleBusinessResponse<T>(
  res: AxiosResponse<ApiResponse<T>>,
): T {
  const body = res.data
  if (body.code !== SUCCESS_CODE) {
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
