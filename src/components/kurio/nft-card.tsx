import { Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import type { NftSummary } from '@/contracts/api'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { NftImage } from './nft-image'

export function NftCard({
  nft,
  favorite,
  onToggleFavorite,
  priority,
  className,
}: {
  nft: NftSummary
  favorite?: boolean
  onToggleFavorite?: () => void
  priority?: boolean
  className?: string
}) {
  return (
    <article className={cn('group relative', className)} aria-labelledby={`nft-${nft.id}-name`}>
      <div className="relative bg-kurio-surface p-1 transition-colors group-hover:bg-kurio-surface-2 md:px-1 md:pb-5 md:pt-6">
        {nft.rarity && (
          <span className="absolute left-0 top-0 z-10 bg-primary px-3.5 py-1 text-[15px] font-medium text-kurio-bg uppercase">
            {nft.rarity}
          </span>
        )}
        <NftImage base={nft.image} alt={nft.imageAlt} priority={priority} className={cn('rounded-[16px]', nft.soldOut && 'opacity-50 grayscale')} />
        {nft.soldOut && (
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-kurio-bg/85 py-2 text-center text-sm font-bold tracking-wider">ESGOTADO</span>
        )}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-pressed={favorite}
            aria-label={favorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
            className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-lg bg-kurio-bg/70 text-primary opacity-100 transition md:top-8 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 data-[on=true]:opacity-100"
            data-on={favorite}
          >
            <Heart className="size-5" fill={favorite ? 'currentColor' : 'none'} aria-hidden />
          </button>
        )}
      </div>
      <h3 id={`nft-${nft.id}-name`} className="mt-4 text-[15px] md:text-[16px]">
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-focus-within:underline">
          {nft.name}
        </Link>
      </h3>
      <p className="mt-1 text-[15px] font-bold text-primary md:text-[18px]">
        <span className="sr-only">Preço: </span>
        {formatEth(nft.price)}
        {nft.compareAtPrice && (
          <>
            <span className="sr-only">, antes </span>
            <s className="ml-3 font-normal text-kurio-sand">{formatEth(nft.compareAtPrice)}</s>
          </>
        )}
      </p>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div aria-hidden className="space-y-3">
      <div className="bg-kurio-surface p-1 md:px-1 md:pb-5 md:pt-6">
        <Skeleton className="aspect-square w-full rounded-[16px]" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-5 w-1/3" />
    </div>
  )
}
