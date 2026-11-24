import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { FavoritesResponse } from '@/contracts/api'
import { favoritesApi } from '@/api/endpoints'
import { isApiError } from '@/api/http'
import { useSession } from '@/session/session-store'
import { qk } from './client'

export function useFavorites() {
  const { user } = useSession()
  return useQuery({
    queryKey: qk.favorites(user?.id ?? 'anon'),
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
    enabled: Boolean(user),
  })
}

/**
 * Optimistic toggle with rollback: the heart flips immediately, the previous
 * snapshot is restored if the API fails, and the cache is re-synced afterwards.
 */
export function useToggleFavorite() {
  const qc = useQueryClient()
  const { user } = useSession()
  const key = qk.favorites(user?.id ?? 'anon')
  return useMutation({
    mutationKey: ['favorites', 'toggle'],
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<FavoritesResponse>(key)
      qc.setQueryData<FavoritesResponse>(key, (old) => {
        const ids = new Set(old?.nftIds ?? [])
        if (favorite) ids.add(nftId)
        else ids.delete(nftId)
        return { nftIds: [...ids] }
      })
      return { previous }
    },
    onError: (error, vars, ctx) => {
      qc.setQueryData(key, ctx?.previous)
      toast.error(
        `Não foi possível ${vars.favorite ? 'favoritar' : 'remover dos favoritos'} ${vars.name}. ${isApiError(error) ? error.message : ''}`.trim(),
      )
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.favorite ? `${vars.name} adicionado aos favoritos.` : `${vars.name} removido dos favoritos.`)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}
