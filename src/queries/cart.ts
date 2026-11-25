import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Cart, CartLineInput, Network } from '@/contracts/api'
import { cartApi } from '@/api/endpoints'
import { isApiError } from '@/api/http'
import { createStore, useStore } from '@/lib/store'
import { getGuestCartId, sessionStore, useSession } from '@/session/session-store'
import { qk } from './client'

export function cartOwnerKey() {
  const { user } = sessionStore.get()
  return user ? `user:${user.id}` : `guest:${getGuestCartId()}`
}

export function useCartOwner() {
  const { user } = useSession()
  return user ? `user:${user.id}` : `guest:${getGuestCartId()}`
}

export function useCart() {
  const owner = useCartOwner()
  return useQuery({
    queryKey: qk.cart(owner),
    queryFn: ({ signal }) => cartApi.get({ signal }),
    staleTime: 10_000,
  })
}

function useCartMutation<TVars>(fn: (vars: TVars) => Promise<Cart>, successMessage?: (vars: TVars) => string) {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart, vars) => {
      qc.setQueryData(qk.cart(owner), cart)
      if (successMessage) toast.success(successMessage(vars))
    },
    onError: (error) => {
      if (isApiError(error) && error.code === 'AVAILABILITY_CONFLICT') {
        // stock changed underneath us — refresh the cart and catalog
        void qc.invalidateQueries({ queryKey: qk.cart(owner) })
        void qc.invalidateQueries({ queryKey: ['nfts'] })
      }
      toast.error(isApiError(error) ? error.message : 'Não foi possível atualizar o carrinho.')
    },
  })
}

export const useAddToCart = () =>
  useCartMutation((line: CartLineInput) => cartApi.add(line), (l) => `${l.quantity} item(ns) adicionado(s) ao carrinho.`)

export const useUpdateCartLine = () =>
  useCartMutation(({ lineId, quantity }: { lineId: string; quantity: number }) => cartApi.update(lineId, quantity))

export const useRemoveCartLine = () =>
  useCartMutation(({ lineId }: { lineId: string; name: string }) => cartApi.remove(lineId), (v) => `${v.name} removido do carrinho.`)

/* ───── coupon & network selection (persisted so checkout reuses the cart's choice) ───── */

const COUPON_KEY = 'kurio.coupon.v1'
export const couponStore = createStore<string | null>(localStorage.getItem(COUPON_KEY))
couponStore.subscribe(() => {
  const c = couponStore.get()
  if (c) localStorage.setItem(COUPON_KEY, c)
  else localStorage.removeItem(COUPON_KEY)
})
export const useCoupon = () => useStore(couponStore)

export function useQuote(params: { network: Network; enabled?: boolean }) {
  const owner = useCartOwner()
  const coupon = useCoupon()
  const cart = useCart()
  // the quote is keyed by the cart version AND the version of every NFT in it, so any
  // price/stock change that reaches the cart (REST or Socket.IO) yields a fresh quote
  const cartVersion = cart.data ? `${cart.data.version}:${cart.data.lines.map((l) => `${l.lineId}@${l.nft.version}`).join(',')}` : '0'
  const hasItems = (cart.data?.itemCount ?? 0) > 0
  return useQuery({
    queryKey: qk.quote(owner, { coupon, network: params.network, cartVersion }),
    queryFn: ({ signal }) => cartApi.quote({ couponCode: coupon ?? undefined, network: params.network }, { signal }),
    enabled: hasItems && (params.enabled ?? true),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
    retry: false,
  })
}

/** Validates a coupon against the API before storing it. */
export function useApplyCoupon(network: Network) {
  return useMutation({
    mutationFn: (code: string) => cartApi.quote({ couponCode: code, network }),
    onSuccess: (quote) => {
      couponStore.set(quote.coupon?.code ?? null)
      toast.success(`Cupom ${quote.coupon?.code} aplicado: ${quote.coupon?.percentOff}% de desconto.`)
    },
  })
}
