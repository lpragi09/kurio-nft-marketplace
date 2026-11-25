import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import type { NftListParams } from '@/contracts/api'
import { isApiError } from '@/api/http'

/**
 * Query keys. Private data is namespaced under ['user', userId] so logout/user switch
 * can drop it with a single removeQueries and keys never collide across users.
 */
export const qk = {
  nfts: ['nfts'] as const,
  nftList: (params: NftListParams & { ids?: string[] }) => ['nfts', 'list', params] as const,
  nftDetail: (id: string) => ['nfts', 'detail', id] as const,
  cart: (owner: string) => ['cart', owner] as const,
  quote: (owner: string, params: { coupon: string | null; network: string; cartVersion: string }) =>
    ['cart', owner, 'quote', params] as const,
  user: (uid: string) => ['user', uid] as const,
  favorites: (uid: string) => ['user', uid, 'favorites'] as const,
  profile: (uid: string) => ['user', uid, 'profile'] as const,
  wallets: (uid: string) => ['user', uid, 'wallets'] as const,
  order: (uid: string, id: string) => ['user', uid, 'orders', id] as const,
  pendingOrders: (uid: string) => ['user', uid, 'orders', 'pending'] as const,
}

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache(),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        // Retry only transient failures (network/timeout/503), at most once, with backoff.
        retry: (failureCount, error) => isApiError(error) && error.isTransient && failureCount < 1,
        retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 4000),
      },
      mutations: {
        // Mutations are never retried automatically: orders use idempotency keys instead.
        retry: false,
      },
    },
  })
}
