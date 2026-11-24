import { createFileRoute } from '@tanstack/react-router'
import { toListParams, validateCatalogSearch } from '@/features/catalog/catalog-search'
import { HomePage } from '@/features/home/home-page'
import { nftListQuery } from '@/queries/nfts'

export const Route = createFileRoute('/')({
  validateSearch: validateCatalogSearch,
  loaderDeps: ({ search }) => search,
  // warm the cache without blocking navigation (skeletons cover the wait)
  loader: ({ context, deps }) => void context.queryClient.prefetchQuery(nftListQuery(toListParams(deps))),
  component: HomePage,
})
