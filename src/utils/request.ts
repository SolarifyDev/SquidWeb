import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios'

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL as
  | string
  | undefined

// 统一获取 token 的方法，如果你的项目里 key 不同可以在这里改
function getToken(): string | null {
  try {
    return window.localStorage.getItem('AUTH_TOKEN')
  } catch {
    return null
  }
}

// 创建 axios 实例
const instance: AxiosInstance = axios.create({
  baseURL: 'https://test-squid.solarifyai.com/api',
  timeout: 15000,
})

// 请求拦截：自动注入 token
instance.interceptors.request.use(
  (config) => {
    const token = getToken()

    if (token) {
      if (!config.headers) {
        config.headers = {} as any
      }
      ;(config.headers as any).Authorization = `Bearer ${token}`
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
    // 例如：统一处理未登录
    // if (error.response?.status === 401) {
    //   // TODO: 跳转登录页 / 清理本地状态等
    // }
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

