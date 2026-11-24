import { Link } from '@tanstack/react-router'
import { MobileTopBar } from '@/components/layout/mobile-nav'
import { NftCard, NftCardSkeleton } from '@/components/kurio/nft-card'
import { EmptyState, ErrorState } from '@/components/kurio/state-views'
import { useFavorites } from '@/queries/favorites'
import { useNftList } from '@/queries/nfts'
import { useFavoriteToggle } from './use-favorite-toggle'

export function FavoritesPage() {
  const favorites = useFavorites()
  const ids = favorites.data?.nftIds ?? []
  const list = useNftList({ ids, pageSize: 48, page: 1, sort: 'nome', tab: 'todos' }, ids.length > 0)
  const { isFavorite, toggle } = useFavoriteToggle()
  return (
    <>
      <MobileTopBar title="Favoritos" />
      <section className="mx-auto max-w-[1200px] px-6 xl:px-0">
        <h1 className="mt-8 hidden text-2xl font-bold md:block">Lista de interesse</h1>
        <div className="mt-6">
          {favorites.isPending || (ids.length > 0 && list.isPending) ? (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => <NftCardSkeleton key={i} />)}
            </div>
          ) : favorites.isError ? (
            <ErrorState error={favorites.error} onRetry={() => favorites.refetch()} />
          ) : ids.length === 0 ? (
            <EmptyState title="Nenhum favorito ainda" action={<Link to="/" hash="catalogo" className="rounded bg-primary px-6 py-2.5 font-bold text-kurio-bg">Explorar NFTs</Link>}>
              Toque no coração de um NFT para salvá-lo aqui.
            </EmptyState>
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
              {list.data?.items.filter((n) => ids.includes(n.id)).map((n) => (
                <NftCard key={n.id} nft={n} favorite={isFavorite(n.id)} onToggleFavorite={() => toggle(n.id, n.name)} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
