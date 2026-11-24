import type { User } from '@/contracts/api'
import { createStore, useStore } from '@/lib/store'

/**
 * Client session: the opaque bearer token and the user snapshot are persisted so the
 * session survives a refresh; the server remains the authority (GET /auth/session).
 * Passwords are never stored client-side.
 */
export interface SessionState {
  token: string | null
  user: User | null
  expiresAt: string | null
}

const KEY = 'kurio.session.v1'
const GUEST_KEY = 'kurio.guestCart.v1'

function read(): SessionState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as SessionState
  } catch {
    /* ignore */
  }
  return { token: null, user: null, expiresAt: null }
}

export const sessionStore = createStore<SessionState>(read())

sessionStore.subscribe(() => {
  const s = sessionStore.get()
  if (s.token) localStorage.setItem(KEY, JSON.stringify(s))
  else localStorage.removeItem(KEY)
})

// Keep tabs in sync (login/logout in another tab)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) sessionStore.set(read())
  })
}

export const useSession = () => useStore(sessionStore)
export const useCurrentUser = () => useStore(sessionStore, (s) => s.user)
export const isAuthenticated = () => Boolean(sessionStore.get().token)

/** Guest cart id: random, persisted; rotated after it is merged into a user cart. */
export function getGuestCartId(): string {
  let id = localStorage.getItem(GUEST_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(GUEST_KEY, id)
  }
  return id
}

export function rotateGuestCartId() {
  localStorage.setItem(GUEST_KEY, crypto.randomUUID())
}

/** Event fired when the API reports SESSION_EXPIRED / UNAUTHENTICATED for a stored token. */
type ExpiredListener = () => void
const expiredListeners = new Set<ExpiredListener>()
export const onSessionExpired = (fn: ExpiredListener) => {
  expiredListeners.add(fn)
  return () => {
    expiredListeners.delete(fn)
  }
}
export const emitSessionExpired = () => expiredListeners.forEach((fn) => fn())
