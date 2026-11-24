import { Link } from '@tanstack/react-router'
import { NftImage } from '@/components/kurio/nft-image'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import { useNft } from '@/queries/nfts'

const FEATURED_ID = 'sage-nomad-009'

export function FeaturedNft() {
  const nft = useNft(FEATURED_ID)
  return (
    <section aria-labelledby="destaque-titulo" className="relative mt-6 overflow-hidden bg-gradient-to-b from-kurio-band to-kurio-surface pt-5">
      <h2 id="destaque-titulo" className="px-5 text-2xl font-bold text-primary">
        NFT EM DESTAQUE
      </h2>
      <p className="mt-2 text-center text-xl font-bold">OFERTA LIMITADA</p>
      <div className="relative mt-3">
        {nft.data ? (
          <Link to="/nft/$nftId" params={{ nftId: nft.data.id }} className="group block" aria-label={`${nft.data.name}, ${formatEth(nft.data.price)} — ver detalhes`}>
            <NftImage base={nft.data.image} alt={nft.data.imageAlt} className="rounded-[16px] transition group-hover:opacity-90" sizes="310px" />
            <span className="absolute bottom-3 left-3 rounded bg-kurio-bg/80 px-2 py-1 text-sm font-bold text-primary">{formatEth(nft.data.price)}</span>
          </Link>
        ) : (
          <Skeleton className="aspect-square w-full rounded-[16px]" />
        )}
      </div>
    </section>
  )
}
