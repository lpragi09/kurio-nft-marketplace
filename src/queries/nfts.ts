import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import type { NftListParams } from '@/contracts/api'
import { nftApi } from '@/api/endpoints'
import { qk } from './client'

export const nftListQuery = (params: NftListParams & { ids?: string[] }) =>
  queryOptions({
    queryKey: qk.nftList(params),
    // The AbortSignal cancels superseded requests; keying by params guarantees an
    // out-of-order response can only ever populate its own cache entry.
    queryFn: ({ signal }) => nftApi.list(params, { signal }),
    placeholderData: keepPreviousData,
  })

export const nftDetailQuery = (id: string) =>
  queryOptions({
    queryKey: qk.nftDetail(id),
    queryFn: ({ signal }) => nftApi.detail(id, { signal }),
  })

export const useNftList = (params: NftListParams & { ids?: string[] }, enabled = true) =>
  useQuery({ ...nftListQuery(params), enabled })

export const useNft = (id: string) => useQuery(nftDetailQuery(id))
