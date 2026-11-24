import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { authApi } from '@/api/endpoints'
import { expireSession } from '@/session/auth-actions'
import { onSessionExpired, sessionStore, useSession } from '@/session/session-store'

/**
 * - validates the persisted token on boot / focus (GET /auth/session)
 * - reacts to SESSION_EXPIRED from any request: clears private data and sends the
 *   user to login with `redirect` = current location, so the flow can resume.
 */
export function SessionWatcher() {
  const qc = useQueryClient()
  const router = useRouter()
  const { token } = useSession()
  const handling = useRef(false)

  useQuery({
    queryKey: ['session', token],
    queryFn: async ({ signal }) => {
      const s = await authApi.session({ signal })
      sessionStore.set((prev) => (prev.token === token ? { ...prev, user: s.user, expiresAt: s.expiresAt } : prev))
      return s
    },
    enabled: Boolean(token),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  })

  useEffect(
    () =>
      onSessionExpired(() => {
        if (handling.current || !sessionStore.get().token) return
        handling.current = true
        expireSession(qc)
        const { href, pathname } = router.state.location
        toast.warning('Sua sessão expirou. Entre novamente para continuar de onde parou.')
        if (!pathname.startsWith('/entrar')) {
          void router.navigate({ to: '/entrar', search: { redirect: href, motivo: 'expirada' } })
        }
        setTimeout(() => (handling.current = false), 500)
      }),
    [qc, router],
  )
  return null
}
