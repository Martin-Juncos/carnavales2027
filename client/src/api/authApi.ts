import { apiClient } from './apiClient'
import type { AuthenticatedUser } from '../types/domain'

export interface LoginRequest {
  identity: string
  password: string
}

export interface OtpChallenge {
  challengeId: string
  expiresIn: number
}

export interface VerifyOtpRequest {
  challengeId: string
  code: string
}

export interface AuthSessionResponse {
  user: AuthenticatedUser
  expiresAt: string
}

export const authApi = {
  requestOtp(input: LoginRequest): Promise<OtpChallenge> {
    return apiClient.post<OtpChallenge>('/auth/login', input)
  },
  verifyOtp(input: VerifyOtpRequest): Promise<AuthSessionResponse> {
    return apiClient.post<AuthSessionResponse>('/auth/otp/verify', input)
  },
  me(): Promise<{ user: AuthenticatedUser }> {
    return apiClient.get<{ user: AuthenticatedUser }>('/auth/me')
  },
  async logout(): Promise<void> {
    await apiClient.post<null>('/auth/logout')
  },
}
