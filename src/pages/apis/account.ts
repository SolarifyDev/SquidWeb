import axios, { AxiosError } from 'axios'
import { ApiError, ApiResponse } from 'utils/request'

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
}

export interface RegisterRequestDto {
  userName: string
  password: string
  displayName?: string
}

export interface RegisterResponseData {
  isSucceeded: boolean
  userAccount: UserAccountDto
}

const AUTH_BASE_URL =
  ((import.meta as any).env?.VITE_AUTH_BASE_URL as string | undefined) ??
  'https://localhost:7078'

const AUTH_SUCCESS_CODE = 200

export async function login(request: LoginRequestDto): Promise<LoginResponseData> {
  try {
    const res = await axios.post<ApiResponse<LoginResponseData>>(
      `${AUTH_BASE_URL}/auth/login`,
      request,
      {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )

    if (res.data.code !== AUTH_SUCCESS_CODE) {
      throw new ApiError(res.data.msg || 'Login failed', res.data.code, res.status, res.data)
    }

    return res.data.data
  } catch (error) {
    const err = error as AxiosError<any>
    if (err.response?.data) {
      const body = err.response.data
      throw new ApiError(
        body.msg || body.message || err.message || 'Login failed',
        Number(body.code ?? err.response.status ?? 500),
        err.response.status,
        body,
      )
    }
    throw error
  }
}

export async function register(request: RegisterRequestDto): Promise<RegisterResponseData> {
  try {
    const res = await axios.post<ApiResponse<RegisterResponseData>>(
      `${AUTH_BASE_URL}/auth/register`,
      request,
      {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )

    if (res.data.code !== AUTH_SUCCESS_CODE) {
      throw new ApiError(res.data.msg || 'Register failed', res.data.code, res.status, res.data)
    }

    return res.data.data
  } catch (error) {
    const err = error as AxiosError<any>
    if (err.response?.data) {
      const body = err.response.data
      throw new ApiError(
        body.msg || body.message || err.message || 'Register failed',
        Number(body.code ?? err.response.status ?? 500),
        err.response.status,
        body,
      )
    }
    throw error
  }
}
