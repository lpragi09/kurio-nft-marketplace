import type { BuyerInfo, Network, WalletConnection } from '@/contracts/api'

/**
 * Checkout context that must survive a refresh, a reconnect or a session expiry:
 * - the purchase attempt (idempotency key + order id once known) → no duplicate orders
 * - the buyer form draft → resume after re-login
 * - the simulated wallet connection
 */
export interface CheckoutAttempt {
  userId: string
  idempotencyKey: string
  /** hash-like fingerprint of quote id + wallet + network; a new one requires a new key */
  fingerprint: string
  orderId: string | null
  createdAt: number
}

export interface CheckoutDraft {
  buyer: Partial<BuyerInfo>
  walletId: string | null
  provider: WalletConnection['provider'] | null
  network: Network
}

const ATTEMPT_KEY = 'kurio.checkout.attempt.v1'
const DRAFT_KEY = 'kurio.checkout.draft.v1'
const CONNECTION_KEY = 'kurio.checkout.connection.v1'

function readJson<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export const checkoutStorage = {
  getAttempt: (userId: string) => {
    const a = readJson<CheckoutAttempt>(localStorage, ATTEMPT_KEY)
    return a && a.userId === userId ? a : null
  },
  setAttempt: (a: CheckoutAttempt) => localStorage.setItem(ATTEMPT_KEY, JSON.stringify(a)),
  clearAttempt: () => localStorage.removeItem(ATTEMPT_KEY),

  getDraft: () => readJson<CheckoutDraft>(sessionStorage, DRAFT_KEY),
  setDraft: (d: CheckoutDraft) => sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)),

  getConnection: (userId: string) => {
    const c = readJson<WalletConnection & { userId: string }>(sessionStorage, CONNECTION_KEY)
    return c && c.userId === userId ? c : null
  },
  setConnection: (userId: string, c: WalletConnection | null) =>
    c ? sessionStorage.setItem(CONNECTION_KEY, JSON.stringify({ ...c, userId })) : sessionStorage.removeItem(CONNECTION_KEY),
}

export function clearCheckoutState() {
  localStorage.removeItem(ATTEMPT_KEY)
  sessionStorage.removeItem(DRAFT_KEY)
  sessionStorage.removeItem(CONNECTION_KEY)
}
