import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import type { CreateOrderRequest, Order } from '@/contracts/api'
import { orderApi } from '@/api/endpoints'
import { isApiError, type ApiError } from '@/api/http'
import { useStore } from '@/lib/store'
import { qk } from '@/queries/client'
import { realtimeStatus } from '@/realtime/realtime-client'
import { checkoutStorage, type CheckoutAttempt } from './checkout-storage'

export interface StoredAttempt extends CheckoutAttempt {
  body: CreateOrderRequest
}

function fingerprintOf(body: CreateOrderRequest) {
  return [body.quoteId, body.walletId, body.network, body.connectionId, body.expectedTotal].join('|')
}

/**
 * Idempotent order placement.
 * - one idempotency key per (quote, wallet, network, connection, total) attempt, persisted
 * - repeated clicks are ignored while a request is in flight (button disabled + ref guard)
 * - timeouts/network errors re-send the *same* key and body → the server returns the same order
 * - after refresh the stored attempt is resumed instead of creating a new purchase
 */
export function usePlaceOrder(userId: string) {
  const qc = useQueryClient()
  const inFlight = useRef(false)
  const [attempt, setAttemptState] = useState<StoredAttempt | null>(() => checkoutStorage.getAttempt(userId) as StoredAttempt | null)
  const [recovering, setRecovering] = useState(false)

  const saveAttempt = useCallback((a: StoredAttempt | null) => {
    if (a) checkoutStorage.setAttempt(a)
    else checkoutStorage.clearAttempt()
    setAttemptState(a)
  }, [])

  const send = useMutation<Order, ApiError, StoredAttempt>({
    mutationKey: ['orders', 'create'],
    mutationFn: (a) => orderApi.create(a.body, a.idempotencyKey),
    onSuccess: (order, a) => {
      qc.setQueryData(qk.order(userId, order.id), order)
      saveAttempt({ ...a, orderId: order.id })
    },
    onError: (error) => {
      // business rejections invalidate the attempt; transport failures keep it for a safe retry
      if (isApiError(error) && !error.isTransient && error.code !== 'INTERNAL') saveAttempt(null)
    },
  })

  const place = useCallback(
    async (body: CreateOrderRequest) => {
      if (inFlight.current) return
      inFlight.current = true
      try {
        const fp = fingerprintOf(body)
        let a = checkoutStorage.getAttempt(userId) as StoredAttempt | null
        if (!a || a.fingerprint !== fp || a.orderId) {
          a = { userId, idempotencyKey: crypto.randomUUID(), fingerprint: fp, orderId: null, createdAt: Date.now(), body }
          saveAttempt(a)
        }
        try {
          await send.mutateAsync(a)
        } catch (e) {
          // timeout after the server may have committed → recover with the same key once
          if (isApiError(e) && (e.code === 'TIMEOUT' || e.code === 'NETWORK')) {
            setRecovering(true)
            try {
              await send.mutateAsync(a)
            } catch {
              /* surfaced through send.error */
            } finally {
              setRecovering(false)
            }
          }
        }
      } finally {
        inFlight.current = false
      }
    },
    [send, saveAttempt, userId],
  )

  /** Re-sends a stored attempt (after refresh/reconnect) with its original key. */
  const resume = useCallback(async () => {
    const a = checkoutStorage.getAttempt(userId) as StoredAttempt | null
    if (!a || inFlight.current) return
    inFlight.current = true
    setRecovering(true)
    try {
      await send.mutateAsync(a)
    } catch {
      /* shown via send.error */
    } finally {
      setRecovering(false)
      inFlight.current = false
    }
  }, [send, userId])

  const status = useStore(realtimeStatus)
  const orderId = attempt?.orderId ?? null
  const order = useQuery({
    queryKey: qk.order(userId, orderId ?? 'none'),
    queryFn: ({ signal }) => orderApi.get(orderId!, { signal }),
    enabled: Boolean(orderId),
    // Socket.IO is the primary channel; poll only while the socket is down.
    refetchInterval: (q) => (q.state.data?.status === 'pending' && status !== 'connected' ? 3000 : false),
  })

  return {
    place,
    resume,
    reset: () => {
      send.reset()
      saveAttempt(null)
    },
    attempt,
    order: order.data ?? null,
    orderQuery: order,
    sending: send.isPending,
    recovering,
    error: send.error,
  }
}
