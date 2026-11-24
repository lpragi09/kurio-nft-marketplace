import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CatalogSort, CatalogTab, CollectionCategory, Network, NftListResponse } from '@/contracts/api'
import { NETWORKS } from '@/contracts/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { NftCard, NftCardSkeleton } from '@/components/kurio/nft-card'
import { Pagination } from '@/components/kurio/pagination'
import { BackgroundRefresh, EmptyState, ErrorState } from '@/components/kurio/state-views'
import { useNftList } from '@/queries/nfts'
import { useFavoriteToggle } from '@/features/favorites/use-favorite-toggle'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  NETWORK_LABELS,
  SORT_LABELS,
  TAB_LABELS,
  toggleCsv,
  toListParams,
  type CatalogSearch,
} from './catalog-search'
import { FeaturedNft } from './featured-nft'

const route = getRouteApi('/')

export function Catalog() {
  const search = route.useSearch()
  const navigate = useNavigate({ from: '/' })
  const params = toListParams(search)
  const list = useNftList(params)
  const { isFavorite, toggle } = useFavoriteToggle()

  /** every filter change resets pagination; `replace` avoids flooding history while typing */
  const update = (patch: Partial<CatalogSearch>, opts: { keepPage?: boolean; replace?: boolean } = {}) =>
    navigate({
      search: (prev) => ({ ...prev, ...patch, pagina: opts.keepPage ? patch.pagina : undefined }),
      replace: opts.replace,
      resetScroll: false,
      hash: 'catalogo',
    })

  const data = list.data
  const showSkeleton = list.isPending
  const facets = data?.facets

  return (
    <section id="catalogo" aria-labelledby="catalogo-titulo" className="mx-auto mt-10 max-w-[1200px] scroll-mt-4 px-6 md:mt-24 xl:px-0">
      <h2 id="catalogo-titulo" className="sr-only">
        Catálogo de NFTs
      </h2>
      <div className="grid gap-12 lg:grid-cols-[310px_1fr]">
        <aside className="hidden lg:block" aria-label="Filtros">
          <Filters search={search} facets={facets} update={update} />
          <FeaturedNft />
        </aside>

        <div className="min-w-0">
          <Toolbar search={search} update={update} facets={facets} />
          <ActiveFilters search={search} update={update} total={data?.total} />
          <div className="mt-2 flex justify-end">
            <BackgroundRefresh active={list.isFetching && !list.isPending} />
          </div>
          <div aria-live="polite" aria-busy={list.isFetching} className="mt-4">
            {list.isError && !data ? (
              <ErrorState error={list.error} onRetry={() => list.refetch()} retrying={list.isFetching} />
            ) : showSkeleton ? (
              <Grid>
                {Array.from({ length: 9 }, (_, i) => (
                  <NftCardSkeleton key={i} />
                ))}
              </Grid>
            ) : data && data.items.length === 0 ? (
              <EmptyState
                title="Nenhum NFT encontrado"
                action={
                  <Button variant="outline" onClick={() => navigate({ search: {}, hash: 'catalogo', resetScroll: false })}>
                    Limpar filtros
                  </Button>
                }
              >
                {search.q ? `Não encontramos resultados para “${search.q}” com os filtros atuais.` : 'Tente remover alguns filtros.'}
              </EmptyState>
            ) : (
              data && (
                <>
                  <p className="sr-only">
                    {data.total} NFTs encontrados. Página {data.page} de {data.totalPages}.
                  </p>
                  <Grid dimmed={list.isPlaceholderData}>
                    {data.items.map((nft, i) => (
                      <NftCard
                        key={nft.id}
                        nft={nft}
                        priority={i < 3 && data.page === 1}
                        favorite={isFavorite(nft.id)}
                        onToggleFavorite={() => toggle(nft.id, nft.name)}
                      />
                    ))}
                  </Grid>
                  {list.isError && <p role="alert" className="mt-3 text-sm text-kurio-coral">Não foi possível atualizar a lista. Exibindo os últimos resultados.</p>}
                </>
              )
            )}
          </div>
          {data && (
            <div className="mt-14">
              <Pagination page={data.page} totalPages={data.totalPages} onPage={(p) => update({ pagina: p > 1 ? p : undefined }, { keepPage: true })} />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Grid({ children, dimmed }: { children: React.ReactNode; dimmed?: boolean }) {
  return (
    <div className={cn('grid grid-cols-2 gap-x-4 gap-y-10 transition-opacity sm:grid-cols-3 md:gap-x-[34px] md:gap-y-14', dimmed && 'opacity-60')}>
      {children}
    </div>
  )
}

type Update = (patch: Partial<CatalogSearch>, opts?: { keepPage?: boolean; replace?: boolean }) => unknown

function Toolbar({ search, update, facets }: { search: CatalogSearch; update: Update; facets?: NftListResponse['facets'] }) {
  const tab = search.aba ?? 'todos'
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div role="tablist" aria-label="Seções do catálogo" className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 md:gap-5">
        {(Object.keys(TAB_LABELS) as CatalogTab[]).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => update({ aba: t === 'todos' ? undefined : t })}
            className={cn(
              'shrink-0 whitespace-nowrap border-b-2 pb-1 text-[14px] font-bold md:text-[15px]',
              tab === t ? 'border-primary text-primary' : 'border-transparent text-foreground hover:text-primary',
            )}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <MobileFilters search={search} update={update} facets={facets} />
        <label htmlFor="ordem" className="text-[15px] max-sm:sr-only">
          Ordenar por:
        </label>
        <Select value={search.ordem ?? 'recentes'} onValueChange={(v) => update({ ordem: v === 'recentes' ? undefined : (v as CatalogSort) })}>
          <SelectTrigger id="ordem" className="h-8 w-[220px] border-0 bg-transparent px-1 text-[15px] text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as CatalogSort[]).map((s) => (
              <SelectItem key={s} value={s}>
                {SORT_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function ActiveFilters({ search, update, total }: { search: CatalogSearch; update: Update; total?: number }) {
  const chips: { label: string; remove: () => void }[] = []
  if (search.q) chips.push({ label: `Busca: “${search.q}”`, remove: () => update({ q: undefined }) })
  search.cat?.split(',').forEach((c) => chips.push({ label: CATEGORY_LABELS[c as CollectionCategory], remove: () => update({ cat: toggleCsv(search.cat, c) }) }))
  search.rede?.split(',').forEach((n) => chips.push({ label: NETWORK_LABELS[n as Network], remove: () => update({ rede: toggleCsv(search.rede, n) }) }))
  if (search.min || search.max) chips.push({ label: `Preço: ${search.min ?? '0'} – ${search.max ?? '∞'} ETH`, remove: () => update({ min: undefined, max: undefined }) })
  if (!chips.length) return null
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={c.remove}
          className="inline-flex items-center gap-1 rounded-full border border-kurio-line-2 px-3 py-1 text-xs hover:border-primary"
          aria-label={`Remover filtro ${c.label}`}
        >
          {c.label} <X className="size-3" aria-hidden />
        </button>
      ))}
      {total !== undefined && <span className="text-xs text-kurio-khaki">{total} resultado(s)</span>}
    </div>
  )
}

export function Filters({ search, facets, update }: { search: CatalogSearch; facets?: NftListResponse['facets']; update: Update }) {
  const selectedCats = new Set(search.cat?.split(',') ?? [])
  const selectedNets = new Set(search.rede?.split(',') ?? [])
  return (
    <div className="bg-kurio-surface px-5 pb-6 pt-5">
      <fieldset>
        <legend className="text-lg font-bold">Coleções</legend>
        <ul className="mt-4 space-y-1">
          {CATEGORIES.map((c) => (
            <li key={c}>
              <FacetToggle
                checked={selectedCats.has(c)}
                onChange={() => update({ cat: toggleCsv(search.cat, c) })}
                label={CATEGORY_LABELS[c]}
                count={facets?.categories[c]}
                strong
              />
            </li>
          ))}
        </ul>
      </fieldset>
      <PriceFilter search={search} facets={facets} update={update} />
      <fieldset className="mt-8">
        <legend className="text-lg font-bold">Rede</legend>
        <ul className="mt-3 space-y-1">
          {NETWORKS.map((n) => (
            <li key={n}>
              <FacetToggle checked={selectedNets.has(n)} onChange={() => update({ rede: toggleCsv(search.rede, n) })} label={NETWORK_LABELS[n]} count={facets?.networks[n]} />
            </li>
          ))}
        </ul>
      </fieldset>
    </div>
  )
}

function FacetToggle({ checked, onChange, label, count, strong }: { checked: boolean; onChange: () => void; label: string; count?: number; strong?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-center justify-between rounded px-3 py-2 text-[15px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring', checked ? 'bg-kurio-band text-primary' : 'text-kurio-sand hover:text-foreground')}>
      <span className="flex items-center gap-2">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
        <span aria-hidden className={cn('grid size-3.5 place-items-center rounded-sm border', checked ? 'border-primary bg-primary' : 'border-kurio-line-2')}>
          {checked && <span className="size-1.5 rounded-[1px] bg-kurio-bg" />}
        </span>
        {label}
      </span>
      <span className={cn('tabular-nums', strong && 'font-bold text-foreground', !strong && 'text-kurio-sand')}>
        {count === undefined ? '' : `(${count})`}
      </span>
    </label>
  )
}

function PriceFilter({ search, facets, update }: { search: CatalogSearch; facets?: NftListResponse['facets']; update: Update }) {
  const lo = Number(facets?.priceRange.min ?? 0.02)
  const hi = Number(facets?.priceRange.max ?? 12.3)
  const [range, setRange] = useState<[number, number]>([Number(search.min ?? lo), Number(search.max ?? hi)])
  useEffect(() => setRange([Number(search.min ?? lo), Number(search.max ?? hi)]), [search.min, search.max, lo, hi])
  const fmt = (n: number) => n.toFixed(2).replace('.', ',')
  return (
    <fieldset className="mt-8">
      <legend className="text-lg font-bold">Faixa de preço</legend>
      <Slider
        className="mt-5"
        min={lo}
        max={hi}
        step={0.01}
        value={range}
        minStepsBetweenThumbs={1}
        onValueChange={(v) => setRange([v[0]!, v[1]!])}
        aria-label="Faixa de preço em ETH"
        thumbLabels={['Preço mínimo', 'Preço máximo']}
      />
      <p className="mt-3 text-[15px]" aria-live="polite">
        Preço: {fmt(range[0])} - {fmt(range[1])} ETH
      </p>
      <Button
        size="sm"
        className="mt-3 text-[16px]"
        onClick={() =>
          update({
            min: range[0] > lo ? range[0].toFixed(2) : undefined,
            max: range[1] < hi ? range[1].toFixed(2) : undefined,
          })
        }
      >
        Aplicar
      </Button>
    </fieldset>
  )
}

function MobileFilters({ search, update, facets }: { search: CatalogSearch; update: Update; facets?: NftListResponse['facets'] }) {
  const count = (search.cat?.split(',').length ?? 0) + (search.rede?.split(',').length ?? 0) + (search.min || search.max ? 1 : 0)
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden" aria-label={`Filtros${count ? `, ${count} ativos` : ''}`}>
          <SlidersHorizontal aria-hidden /> Filtros{count ? ` (${count})` : ''}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[320px] overflow-y-auto border-kurio-line bg-kurio-bg p-0">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Combine coleções, faixa de preço e rede.</SheetDescription>
        </SheetHeader>
        <Filters search={search} update={update} facets={facets} />
      </SheetContent>
    </Sheet>
  )
}

