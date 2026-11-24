import { createFileRoute } from '@tanstack/react-router'
import type { EditionId } from '@/contracts/api'
import { EDITION_IDS } from '@/contracts/api'
import { NftDetailPage } from '@/features/nft-detail/nft-detail-page'
import { nftDetailQuery } from '@/queries/nfts'

export const Route = createFileRoute('/nft/$nftId')({
  validateSearch: (raw: Record<string, unknown>): { edicao?: EditionId } => ({
    edicao: EDITION_IDS.includes(raw.edicao as EditionId) ? (raw.edicao as EditionId) : undefined,
  }),
  loader: ({ context, params }) => void context.queryClient.prefetchQuery(nftDetailQuery(params.nftId)),
  component: NftDetailPage,
})
