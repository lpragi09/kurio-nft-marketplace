import type { QueryClient } from '@tanstack/react-query'
import type { Session } from '@/contracts/api'
import { authApi, cartApi } from '@/api/endpoints'
import { couponStore } from '@/queries/cart'
import { qk } from '@/queries/client'
import { clearCheckoutState } from '@/features/checkout/checkout-storage'
import { getGuestCartId, rotateGuestCartId, sessionStore } from './session-store'

/** Drops every private cache entry (and in-flight request) from the previous session. */
export function clearPrivateData(qc: QueryClient) {
  void qc.cancelQueries({ queryKey: ['user'] })
  qc.removeQueries({ queryKey: ['user'] })
  qc.removeQueries({ predicate: (q) => q.queryKey[0] === 'cart' && String(q.queryKey[1]).startsWith('user:') })
  couponStore.set(null)
}

export async function completeLogin(qc: QueryClient, session: Session) {
  const previous = sessionStore.get().user
  if (previous && previous.id !== session.user.id) {
    clearPrivateData(qc)
    clearCheckoutState()
  }
  const guestId = getGuestCartId()
  sessionStore.set({ token: session.token, user: session.user, expiresAt: session.expiresAt })
  // Preserve the visitor's cart: merge it server-side into the user's cart.
  try {
    const cart = await cartApi.merge(guestId)
    qc.setQueryData(qk.cart(`user:${session.user.id}`), cart)
    qc.removeQueries({ queryKey: qk.cart(`guest:${guestId}`) })
    rotateGuestCartId()
  } catch {
    void qc.invalidateQueries({ queryKey: ['cart'] })
  }
}

export async function logout(qc: QueryClient) {
  try {
    await authApi.logout()
  } catch {
    /* logging out locally is enough if the API is unreachable */
  }
  clearPrivateData(qc)
  clearCheckoutState()
  sessionStore.set({ token: null, user: null, expiresAt: null })
}

/** Local-only teardown used when the API says the session is no longer valid. */
export function expireSession(qc: QueryClient) {
  clearPrivateData(qc)
  sessionStore.set({ token: null, user: null, expiresAt: null })
}
