import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { Heart, ShoppingCart, Star, ZoomIn } from 'lucide-react'
import { useState } from 'react'
import type { EditionId, Nft } from '@/contracts/api'
import { isApiError } from '@/api/http'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MobileTopBar } from '@/components/layout/mobile-nav'
import { NftCard, NftCardSkeleton } from '@/components/kurio/nft-card'
import { NftImage } from '@/components/kurio/nft-image'
import { QuantityStepper } from '@/components/kurio/quantity-stepper'
import { SocialIcon } from '@/components/kurio/social-icons'
import { EmptyState, ErrorState } from '@/components/kurio/state-views'
import { Breadcrumbs } from '@/components/kurio/breadcrumbs'
import { useAddToCart, useCart } from '@/queries/cart'
import { useNft, useNftList } from '@/queries/nfts'
import { useFavoriteToggle } from '@/features/favorites/use-favorite-toggle'

const route = getRouteApi('/nft/$nftId')

const EDITION_LABEL: Record<EditionId, string> = { '1/1': '1/1', '1/10': '1/10', '1/50': '1/50', aberta: 'ABERTA' }

export function NftDetailPage() {
  const { nftId } = route.useParams()
  const nft = useNft(nftId)

  if (nft.isPending) return <DetailSkeleton />
  if (nft.isError) {
    if (isApiError(nft.error) && nft.error.status === 404) {
      return (
        <div className="mx-auto max-w-[1200px] px-6 py-16">
          <EmptyState
            title="NFT não encontrado"
            action={
              <Link to="/" hash="catalogo" className="rounded bg-primary px-6 py-2.5 font-bold text-kurio-bg">
                Explorar o mercado
              </Link>
            }
          >
            O NFT “{nftId}” não existe ou foi removido do mercado.
          </EmptyState>
        </div>
      )
    }
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-16">
        <ErrorState error={nft.error} onRetry={() => nft.refetch()} retrying={nft.isFetching} />
      </div>
    )
  }
  return <NftDetail nft={nft.data} />
}

function NftDetail({ nft }: { nft: Nft }) {
  const search = route.useSearch()
  const navigate = useNavigate({ from: '/nft/$nftId' })
  const cart = useCart()
  const add = useAddToCart()
  const { isFavorite, toggle } = useFavoriteToggle()
  const favorite = isFavorite(nft.id)

  // chosen once: a realtime sell-out must not silently switch the edition under the user
  const [defaultEditionId] = useState(
    () => (nft.editions.find((e) => e.id === '1/50' && e.available > 0) ?? nft.editions.find((e) => e.available > 0) ?? nft.editions[2]!).id,
  )
  const defaultEdition = nft.editions.find((e) => e.id === defaultEditionId)!
  const edition = nft.editions.find((e) => e.id === search.edicao) ?? defaultEdition
  const inCart = cart.data?.lines.find((l) => l.nftId === nft.id && l.edition === edition.id)?.quantity ?? 0
  const maxQty = Math.max(0, Math.min(edition.available, edition.maxPerOrder) - inCart)
  const [qty, setQty] = useState(1)
  const quantity = Math.min(Math.max(1, qty), Math.max(1, maxQty))
  const unavailable = edition.available === 0
  const limitReached = !unavailable && maxQty === 0

  const buy = (goToCart: boolean) =>
    add.mutate(
      { nftId: nft.id, edition: edition.id, quantity },
      { onSuccess: () => (goToCart ? void navigate({ to: '/carrinho' }) : setQty(1)) },
    )

  const availabilityText = unavailable
    ? `A edição ${EDITION_LABEL[edition.id]} está esgotada. Escolha outra edição.`
    : limitReached
      ? `Você já tem o máximo permitido desta edição no carrinho (${inCart}).`
      : `${edition.available > 900 ? 'Disponível' : `${edition.available} disponível(is)`} · máximo ${edition.maxPerOrder} por pedido${inCart ? ` · ${inCart} no carrinho` : ''}`

  return (
    <>
      <MobileTopBar
        action={
          <button
            type="button"
            aria-pressed={favorite}
            aria-label={favorite ? 'Remover dos favoritos' : 'Favoritar'}
            onClick={() => toggle(nft.id, nft.name)}
            className="grid size-9 place-items-center rounded-full bg-kurio-surface-2 text-kurio-sand"
          >
            <Heart className="size-5" fill={favorite ? 'currentColor' : 'none'} aria-hidden />
          </button>
        }
      />
      <div className="mx-auto max-w-[1200px] px-6 xl:px-0">
        <Breadcrumbs className="hidden md:flex" items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/', hash: 'catalogo' }, { label: nft.name }]} />
        <div className="mt-3 grid gap-8 md:grid-cols-[1fr_1fr] lg:grid-cols-[100px_444px_1fr] lg:gap-7">
          <Gallery nft={nft} />
          <div className="min-w-0 rounded-t-[29px] max-md:-mx-6 max-md:bg-kurio-surface max-md:px-6 max-md:pt-6">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-[20px] font-bold md:text-[28px]">{nft.name}</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary px-2 py-0.5 text-sm md:hidden">
                <Star className="size-3.5 text-primary" fill="currentColor" aria-hidden /> {nft.rating.toFixed(1)}
                <span className="text-kurio-sand">({nft.reviewCount})</span>
              </span>
            </div>
            <div className="mt-2 hidden flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-kurio-line-2 pb-3 md:flex">
              <p className="whitespace-nowrap text-[22px] font-bold text-primary" aria-live="polite">
                <span className="sr-only">Preço da edição {EDITION_LABEL[edition.id]}: </span>
                {formatEth(edition.price)}
              </p>
              <p className="flex items-center gap-1 text-[15px]">
                <span className="flex text-primary" aria-hidden>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className="size-4" fill="currentColor" />
                  ))}
                </span>
                <span className="sr-only">Nota {nft.rating} de 5, </span>
                {nft.reviewCount} avaliações de colecionadores
              </p>
            </div>
            <h2 className="mt-5 hidden text-[15px] font-bold md:block">Sobre este NFT:</h2>
            <p className="mt-2 text-[14px] leading-6 text-kurio-sand md:text-[15px]">{nft.description}</p>

            <fieldset className="mt-4">
              <legend className="text-[15px] font-bold">Edição:</legend>
              <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Edição">
                {nft.editions.map((e) => {
                  const selected = e.id === edition.id
                  return (
                    <button
                      key={e.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`Edição ${EDITION_LABEL[e.id]}, ${formatEth(e.price)}${e.available === 0 ? ', esgotada' : ''}`}
                      onClick={() => {
                        setQty(1)
                        void navigate({ search: { edicao: e.id === defaultEdition.id ? undefined : e.id }, replace: true, resetScroll: false })
                      }}
                      className={cn(
                        'rounded-full border px-2 py-1 text-[14px] transition',
                        selected ? 'border-primary text-primary' : 'border-kurio-line-2 text-kurio-sand hover:border-primary',
                        e.available === 0 && 'line-through decoration-kurio-coral',
                      )}
                    >
                      {EDITION_LABEL[e.id]}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <p className={cn('mt-2 text-xs', unavailable || limitReached ? 'text-kurio-coral' : 'text-kurio-khaki')} role="status">
              {availabilityText}
            </p>

            <div className="mt-4 hidden flex-wrap items-center justify-between gap-4 md:flex">
              <QuantityStepper value={quantity} max={Math.max(1, maxQty)} onChange={setQty} label={nft.name} disabled={unavailable || limitReached} />
              <div className="flex gap-2">
                <Button size="lg" className="w-[130px]" onClick={() => buy(true)} disabled={unavailable || limitReached || add.isPending}>
                  {add.isPending ? 'Adicionando…' : 'COMPRAR'}
                </Button>
                <Button size="lg" variant="outline" aria-pressed={favorite} onClick={() => toggle(nft.id, nft.name)} className="text-[16px] font-normal text-kurio-sand">
                  <Heart className="size-5" fill={favorite ? 'currentColor' : 'none'} aria-hidden /> {favorite ? 'Favoritado' : 'Favoritar'}
                </Button>
              </div>
            </div>

            <dl className="mt-5 space-y-2 text-[15px] text-kurio-sand md:space-y-3">
              <div>
                <dt className="inline">ID do token: </dt>
                <dd className="inline">{nft.tokenId}</dd>
              </div>
              <div>
                <dt className="inline">Coleção: </dt>
                <dd className="inline">{nft.collectionName}</dd>
              </div>
              <div>
                <dt className="inline">Atributos: </dt>
                <dd className="inline">{nft.attributes.join(', ')}</dd>
              </div>
            </dl>
            <Share nft={nft} />
          </div>
        </div>

        <Tabs defaultValue="detalhes" className="mt-16 hidden md:flex">
          <TabsList className="h-auto w-full justify-start gap-8 rounded-none border-b border-kurio-line-2 bg-transparent p-0">
            <TabsTrigger value="detalhes" className="tab-kurio">
              Detalhes do NFT
            </TabsTrigger>
            <TabsTrigger value="avaliacoes" className="tab-kurio">
              Avaliações de colecionadores ({nft.reviewCount})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="detalhes" className="mt-4 space-y-5 text-[15px] leading-6 text-kurio-sand">
            {nft.longDescription.map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
            <DetailBlock title="Rede:">Cunhado na {nft.network === 'ethereum' ? 'Ethereum' : nft.network === 'polygon' ? 'Polygon' : 'Solana'} com procedência imutável e metadados armazenados no IPFS.</DetailBlock>
            <DetailBlock title="Contrato:">Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</DetailBlock>
            <DetailBlock title="Direitos autorais:">
              {nft.contractAddress.slice(0, 6)}...{nft.contractAddress.slice(-4)} • Contrato inteligente ERC-721 verificado.
            </DetailBlock>
          </TabsContent>
          <TabsContent value="avaliacoes" className="mt-4">
            <Reviews nft={nft} />
          </TabsContent>
        </Tabs>

        <MoreFromCollection nft={nft} />
      </div>

      {/* mobile purchase bar */}
      <div className="sticky bottom-[70px] z-30 mt-6 rounded-t-[29px] bg-kurio-surface px-6 pb-4 pt-4 shadow-[0_-10px_30px_rgba(0,0,0,0.35)] md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[15px]">Qtd.</span>
            <QuantityStepper size="sm" value={quantity} max={Math.max(1, maxQty)} onChange={setQty} label={nft.name} disabled={unavailable || limitReached} />
          </div>
          <p className="text-[20px] font-bold text-primary">{formatEth(edition.price)}</p>
        </div>
        <div className="mt-3 flex gap-3">
          <Button className="h-[60px] flex-1 rounded-[37px] text-[16px]" onClick={() => buy(true)} disabled={unavailable || limitReached || add.isPending}>
            Comprar NFT
          </Button>
          <Button
            variant="ghost"
            className="size-[60px] rounded-full bg-kurio-surface-2 text-primary"
            aria-label="Adicionar ao carrinho"
            onClick={() => buy(false)}
            disabled={unavailable || limitReached || add.isPending}
          >
            <ShoppingCart className="size-5" aria-hidden />
          </Button>
        </div>
      </div>
    </>
  )
}

function Gallery({ nft }: { nft: Nft }) {
  const [active, setActive] = useState(0)
  const crops = ['object-center', 'object-top scale-125', 'object-bottom scale-110', 'object-left scale-125']
  return (
    <>
      <ul className="hidden gap-4 lg:flex lg:flex-col" aria-label="Galeria">
        {nft.gallery.map((src, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ver imagem ${i + 1} de ${nft.gallery.length}`}
              aria-current={i === active}
              className={cn('block overflow-hidden rounded-[3px] border-2 transition', i === active ? 'border-primary' : 'border-transparent hover:border-kurio-line-2')}
            >
              <NftImage base={src} alt="" decorative sizes="100px" className={cn('size-[100px] transition-transform', crops[i])} />
            </button>
          </li>
        ))}
      </ul>
      <div className="relative self-start rounded-[6px] md:bg-kurio-surface md:p-5">
        <div className="overflow-hidden rounded-[16px]">
          <NftImage base={nft.gallery[active] ?? nft.image} alt={nft.imageAlt} priority sizes="(min-width: 1024px) 404px, 100vw" className={cn('transition-transform', crops[active])} />
        </div>
        <Dialog>
          <DialogTrigger className="absolute right-3 top-3 hidden size-[30px] place-items-center rounded-full bg-kurio-surface text-foreground md:grid" aria-label="Ampliar imagem">
            <ZoomIn className="size-5" aria-hidden />
          </DialogTrigger>
          <DialogContent className="max-w-[min(90vw,820px)] border-b-0 p-2 sm:max-w-[min(90vw,820px)]">
            <DialogTitle className="sr-only">{nft.name}</DialogTitle>
            <DialogDescription className="sr-only">{nft.imageAlt}</DialogDescription>
            <NftImage base={nft.image} alt={nft.imageAlt} sizes="820px" className="rounded" />
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}

function Share({ nft }: { nft: Nft }) {
  const url = typeof window !== 'undefined' ? `${window.location.origin}/nft/${nft.id}` : ''
  const text = `${nft.name} na Kurio`
  const links = [
    { name: 'linkedin' as const, label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { name: 'mail' as const, label: 'e-mail', href: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}` },
    { name: 'twitter' as const, label: 'Twitter', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
  ]
  return (
    <div className="mt-4 hidden items-center gap-3 md:flex">
      <span className="text-[15px] font-bold">Compartilhar este NFT:</span>
      {links.map((l) => (
        <a key={l.name} href={l.href} target="_blank" rel="noopener noreferrer" aria-label={`Compartilhar por ${l.label} (abre em nova aba)`} className="hover:text-primary">
          <SocialIcon name={l.name} className="size-4" />
        </a>
      ))}
    </div>
  )
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-bold text-foreground">{title}</h3>
      <p className="mt-1">{children}</p>
    </div>
  )
}

function Reviews({ nft }: { nft: Nft }) {
  const reviews = [
    { who: 'ana.colecionadora', text: 'Arte impecável e a procedência ficou registrada na hora. Entrega da edição foi instantânea.' },
    { who: 'bruno.nft', text: 'Detalhes incríveis na versão em alta resolução. Vale cada ETH.' },
    { who: 'nova.sato', text: `Uma das melhores peças da coleção ${nft.collectionName}.` },
  ]
  return (
    <ul className="space-y-4">
      {reviews.map((r) => (
        <li key={r.who} className="rounded bg-kurio-surface p-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            {r.who}
            <span className="flex text-primary" aria-label="5 de 5 estrelas">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className="size-3" fill="currentColor" aria-hidden />
              ))}
            </span>
          </p>
          <p className="mt-1 text-sm text-kurio-sand">{r.text}</p>
        </li>
      ))}
    </ul>
  )
}

function MoreFromCollection({ nft }: { nft: Nft }) {
  const list = useNftList({ categories: [nft.category], pageSize: 6, sort: 'recentes', tab: 'todos', page: 1 })
  const items = (list.data?.items ?? []).filter((n) => n.id !== nft.id).slice(0, 5)
  return (
    <section aria-labelledby="mais-colecao" className="mt-20 hidden md:block">
      <h2 id="mais-colecao" className="border-b border-kurio-line-2 pb-3 text-lg font-bold text-primary">
        Mais desta coleção
      </h2>
      <div className="mt-8 grid grid-cols-3 gap-6 lg:grid-cols-5">
        {list.isPending ? Array.from({ length: 5 }, (_, i) => <NftCardSkeleton key={i} />) : items.map((n) => <NftCard key={n.id} nft={n} />)}
      </div>
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-[1200px] px-6 xl:px-0" aria-busy="true" aria-label="Carregando NFT">
      <Skeleton className="mt-6 hidden h-4 w-40 md:block" />
      <div className="mt-3 grid gap-8 md:grid-cols-2 lg:grid-cols-[100px_444px_1fr] lg:gap-7">
        <div className="hidden flex-col gap-4 lg:flex">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="size-[100px] rounded-[3px]" />
          ))}
        </div>
        <div className="rounded-[6px] md:bg-kurio-surface md:p-5">
          <Skeleton className="aspect-square w-full rounded-[16px]" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-20 w-1/2" />
        </div>
      </div>
    </div>
  )
}
