import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, type LoginRequest, type OtpChallenge, type VerifyOtpRequest } from '../../api/authApi'
import { ApiClientError } from '../../api/apiClient'
import { clearSessionSnapshot, getSessionSnapshot, saveSessionSnapshot } from '../../offline/syncRepository'
import type { AuthenticatedUser } from '../../types/domain'

interface AuthState {
  user: AuthenticatedUser | null
  status: 'checking' | 'authenticated' | 'unauthenticated' | 'offline'
  offlineSession: boolean
}

interface AuthContextValue extends AuthState {
  requestOtp: (input: LoginRequest) => Promise<OtpChallenge>
  verifyOtp: (input: VerifyOtpRequest) => Promise<void>
  restore: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, status: 'checking', offlineSession: false })

  const restore = useCallback(async () => {
    setState((current) => ({ ...current, status: 'checking' }))
    try {
      const response = await authApi.me()
      await saveSessionSnapshot(response.user)
      setState({ user: response.user, status: 'authenticated', offlineSession: false })
    } catch (error) {
      const snapshot = await getSessionSnapshot()
      if (snapshot && (!(error instanceof ApiClientError) || error.retryable || error.status === 0)) {
        setState({ user: snapshot.user, status: 'offline', offlineSession: true })
        return
      }
      await clearSessionSnapshot()
      setState({ user: null, status: 'unauthenticated', offlineSession: false })
    }
  }, [])

  useEffect(() => {
    void restore()
  }, [restore])

  const requestOtp = useCallback((input: LoginRequest) => authApi.requestOtp(input), [])

  const verifyOtp = useCallback(async (input: VerifyOtpRequest) => {
    const response = await authApi.verifyOtp(input)
    await saveSessionSnapshot(response.user, response.expiresAt)
    setState({ user: response.user, status: 'authenticated', offlineSession: false })
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      await clearSessionSnapshot()
      setState({ user: null, status: 'unauthenticated', offlineSession: false })
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ ...state, requestOtp, verifyOtp, restore, logout }), [logout, requestOtp, restore, state, verifyOtp])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
