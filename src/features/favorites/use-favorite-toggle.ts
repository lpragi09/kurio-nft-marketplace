import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useFavorites, useToggleFavorite } from '@/queries/favorites'
import { useSession } from '@/session/session-store'

/** Favorites require auth: visitors are sent to login and come back afterwards. */
export function useFavoriteToggle() {
  const { user } = useSession()
  const favorites = useFavorites()
  const mutation = useToggleFavorite()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const ids = new Set(favorites.data?.nftIds ?? [])
  return {
    isFavorite: (id: string) => ids.has(id),
    toggle: (nftId: string, name: string) => {
      if (!user) {
        toast.info('Entre na sua conta para salvar favoritos.')
        void navigate({ to: '/entrar', search: { redirect: href } })
        return
      }
      mutation.mutate({ nftId, favorite: !ids.has(nftId), name })
    },
    pending: mutation.isPending,
  }
}
