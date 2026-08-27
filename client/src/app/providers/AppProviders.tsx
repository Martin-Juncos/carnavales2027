import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { AuthProvider } from '../../features/auth/AuthProvider'
import { startSyncRuntime } from '../../offline/syncEngine'

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: true,
        staleTime: 15_000,
      },
      mutations: { retry: 0 },
    },
  }))

  useEffect(() => startSyncRuntime(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}
