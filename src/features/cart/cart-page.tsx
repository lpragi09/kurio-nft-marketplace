import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import type { Cart, CartLine, Quote } from '@/contracts/api'
import { isApiError } from '@/api/http'
import { formatEth } from '@/lib/eth'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MobileTopBar } from '@/components/layout/mobile-nav'
import { Breadcrumbs } from '@/components/kurio/breadcrumbs'
import { NftCard, NftCardSkeleton } from '@/components/kurio/nft-card'
import { NftImage } from '@/components/kurio/nft-image'
import { QuantityStepper } from '@/components/kurio/quantity-stepper'
import { EmptyState, ErrorState } from '@/components/kurio/state-views'
import { couponStore, useApplyCoupon, useCart, useCoupon, useQuote, useRemoveCartLine, useUpdateCartLine } from '@/queries/cart'
import { useNftList } from '@/queries/nfts'
import { priceNotices } from '@/realtime/realtime-client'

export function CartPage() {
  const cart = useCart()
  return (
    <>
      <MobileTopBar title="Carrinho de NFTs" />
      <div className="mx-auto max-w-[1200px] px-6 xl:px-0">
        <Breadcrumbs className="hidden md:flex" items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/', hash: 'catalogo' }, { label: 'Carrinho' }]} />
        <h1 className="sr-only">Carrinho de NFTs</h1>
        <PriceChangeNotices cart={cart.data} />
        {cart.isPending ? (
          <CartSkeleton />
        ) : cart.isError ? (
          <div className="mt-6">
            <ErrorState error={cart.error} onRetry={() => cart.refetch()} retrying={cart.isFetching} />
          </div>
        ) : cart.data.lines.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="Seu carrinho está vazio"
              action={
                <Link to="/" hash="catalogo" className="rounded bg-primary px-6 py-2.5 font-bold text-kurio-bg">
                  Explorar NFTs
                </Link>
              }
            >
              Adicione NFTs do mercado para vê-los aqui.
            </EmptyState>
          </div>
        ) : (
          <div className="mt-2 grid gap-10 lg:grid-cols-[782px_1fr] lg:gap-[86px]">
            <CartLines cart={cart.data} />
            <CartSummary />
          </div>
        )}
        <AlsoViewed />
      </div>
    </>
  )
}

function PriceChangeNotices({ cart }: { cart?: Cart }) {
  const notices = useStore(priceNotices)
  const relevant = notices.filter((n) => cart?.lines.some((l) => l.nftId === n.nftId))
  return (
    <div role="status" aria-live="polite" className="mt-3 space-y-2">
      {relevant.map((n) => (
        <p key={n.id} data-testid="price-notice" className="flex items-start gap-2 rounded border border-primary/60 bg-kurio-band px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span className="flex-1">
            <strong>{n.name}:</strong> {n.message}. O resumo foi atualizado.
          </span>
          <button type="button" aria-label="Dispensar aviso" onClick={() => priceNotices.set((l) => l.filter((x) => x.id !== n.id))}>
            <X className="size-4" aria-hidden />
          </button>
        </p>
      ))}
    </div>
  )
}

function CartLines({ cart }: { cart: Cart }) {
  return (
    <section aria-label="Itens do carrinho">
      <table className="w-full border-separate border-spacing-y-3 max-md:hidden">
        <thead>
          <tr className="text-left text-[16px] font-bold">
            <th scope="col" className="border-b border-kurio-line-2 pb-3 font-bold">NFTs</th>
            <th scope="col" className="border-b border-kurio-line-2 pb-3 font-bold">Preço</th>
            <th scope="col" className="border-b border-kurio-line-2 pb-3 font-bold">Edições</th>
            <th scope="col" className="border-b border-kurio-line-2 pb-3 font-bold">Total</th>
            <th scope="col" className="border-b border-kurio-line-2 pb-3">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {cart.lines.map((line) => (
            <LineRow key={line.lineId} line={line} />
          ))}
        </tbody>
      </table>
      <ul className="space-y-3 md:hidden">
        {cart.lines.map((line) => (
          <LineCard key={line.lineId} line={line} />
        ))}
      </ul>
    </section>
  )
}

function useLineActions(line: CartLine) {
  const update = useUpdateCartLine()
  const remove = useRemoveCartLine()
  const max = Math.min(line.available, line.maxPerOrder)
  return {
    max,
    busy: update.isPending || remove.isPending,
    setQty: (q: number) => update.mutate({ lineId: line.lineId, quantity: q }),
    remove: () => remove.mutate({ lineId: line.lineId, name: line.nft.name }),
  }
}

function AdjustedNote({ line }: { line: CartLine }) {
  if (!line.adjusted) return null
  return (
    <span className="mt-1 block text-xs text-kurio-coral">
      {line.adjusted === 'sold-out' ? 'Edição esgotada — remova este item.' : `Quantidade ajustada ao estoque (${line.available}).`}
    </span>
  )
}

function LineRow({ line }: { line: CartLine }) {
  const a = useLineActions(line)
  const soldOut = line.adjusted === 'sold-out'
  return (
    <tr className={cn('bg-kurio-surface', soldOut && 'opacity-70')}>
      <td className="w-[311px] p-0">
        <div className="flex items-center gap-4">
          <NftImage base={line.nft.image} alt="" decorative sizes="70px" className="size-[70px]" />
          <div>
            <Link to="/nft/$nftId" params={{ nftId: line.nftId }} search={{ edicao: line.edition }} className="text-[16px] font-bold hover:text-primary">
              {line.nft.name}
            </Link>
            <p className="text-[14px] text-kurio-sand">
              ID do token: {line.nft.tokenId} · Ed. {line.edition}
            </p>
            <AdjustedNote line={line} />
          </div>
        </div>
      </td>
      <td className="text-[16px] font-bold text-kurio-sand">{formatEth(line.unitPrice)}</td>
      <td>
        <QuantityStepper size="sm" value={line.quantity} max={Math.max(line.quantity, a.max)} onChange={a.setQty} label={line.nft.name} disabled={a.busy || soldOut} />
      </td>
      <td className="text-[16px] font-bold text-primary">{formatEth(line.lineTotal)}</td>
      <td className="pr-6 text-right">
        <button type="button" onClick={a.remove} disabled={a.busy} aria-label={`Remover ${line.nft.name} do carrinho`} className="rounded p-1 text-kurio-sand hover:text-kurio-coral">
          <Trash2 className="size-5" aria-hidden />
        </button>
      </td>
    </tr>
  )
}

function LineCard({ line }: { line: CartLine }) {
  const a = useLineActions(line)
  return (
    <li className="flex overflow-hidden rounded-[12px] bg-kurio-surface">
      <NftImage base={line.nft.image} alt="" decorative sizes="100px" className="size-[100px] shrink-0" />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold">{line.nft.name}</p>
          <p className="text-[13px] text-kurio-sand">Edição: {line.edition}</p>
          <p className="mt-2 text-[17px] font-bold text-primary">{formatEth(line.lineTotal)}</p>
          <AdjustedNote line={line} />
        </div>
        <div className="flex flex-col items-end gap-2">
          <button type="button" onClick={a.remove} aria-label={`Remover ${line.nft.name} do carrinho`} className="text-kurio-sand">
            <Trash2 className="size-4" aria-hidden />
          </button>
          <QuantityStepper size="sm" value={line.quantity} max={Math.max(line.quantity, a.max)} onChange={a.setQty} label={line.nft.name} disabled={a.busy || line.adjusted === 'sold-out'} />
        </div>
      </div>
    </li>
  )
}

export function CartSummary() {
  const quote = useQuote({ network: 'ethereum' })
  const navigate = useNavigate()
  const cart = useCart()
  const hasSoldOut = cart.data?.lines.some((l) => l.adjusted === 'sold-out')
  return (
    <section aria-labelledby="resumo" className="max-md:-mx-6 max-md:rounded-t-[29px] max-md:bg-kurio-surface max-md:px-6 max-md:py-6">
      <h2 id="resumo" className="hidden border-b border-kurio-line-2 pb-3 text-[18px] font-bold md:block">
        Resumo da carteira
      </h2>
      <CouponField />
      <QuoteBreakdown quote={quote.data} loading={quote.isPending && quote.fetchStatus !== 'idle'} error={quote.isError ? quote.error : null} refreshing={quote.isFetching && !quote.isPending} />
      {hasSoldOut && <p className="mt-3 text-sm text-kurio-coral">Remova os itens esgotados para continuar.</p>}
      <Button
        className="mt-6 h-11 w-full text-[16px] max-md:h-[60px] max-md:rounded-[37px]"
        disabled={!quote.data || hasSoldOut || quote.isFetching}
        onClick={() => navigate({ to: '/pagamento' })}
      >
        Conectar e finalizar
      </Button>
      <Link to="/" hash="catalogo" className="mt-4 block text-center text-[16px] text-primary hover:underline max-md:hidden">
        Continuar explorando
      </Link>
    </section>
  )
}

export function CouponField() {
  const coupon = useCoupon()
  const apply = useApplyCoupon('ethereum')
  const [code, setCode] = useState(coupon ?? '')
  const id = useId()
  const errorId = `${id}-error`
  useEffect(() => setCode(coupon ?? ''), [coupon])
  const error = apply.error && isApiError(apply.error) ? (apply.error.fields?.couponCode ?? apply.error.message) : null
  return (
    <form
      className="mt-6"
      onSubmit={(e) => {
        e.preventDefault()
        if (code.trim()) apply.mutate(code.trim())
      }}
    >
      <label htmlFor={id} className="text-[14px] font-bold max-md:sr-only">
        Código promocional
      </label>
      <div className="mt-2 flex max-md:rounded-full max-md:bg-kurio-bg">
        <input
          id={id}
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            apply.reset()
          }}
          placeholder="Digite o código promocional..."
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="h-10 min-w-0 flex-1 rounded-l border border-primary bg-transparent px-2 text-[13px] uppercase placeholder:normal-case placeholder:text-kurio-khaki focus:outline-2 focus:outline-primary max-md:h-12 max-md:rounded-l-full max-md:border-0 max-md:px-4"
        />
        <Button type="submit" className="h-10 rounded-l-none px-5 text-[16px] max-md:h-12 max-md:rounded-full" disabled={apply.isPending || !code.trim()}>
          {apply.isPending ? 'Validando…' : 'Aplicar'}
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-kurio-coral">
          {error}
        </p>
      )}
      {coupon && !error && (
        <p className="mt-1.5 flex items-center justify-between text-xs text-kurio-success">
          <span>Cupom {coupon} aplicado.</span>
          <button type="button" className="text-kurio-sand underline" onClick={() => couponStore.set(null)}>
            Remover cupom
          </button>
        </p>
      )}
    </form>
  )
}

export function QuoteBreakdown({ quote, loading, error, refreshing }: { quote?: Quote; loading: boolean; error: unknown; refreshing?: boolean }) {
  // a coupon that became invalid/expired after being applied is dropped automatically
  useEffect(() => {
    if (isApiError(error) && (error.code === 'COUPON_EXPIRED' || error.code === 'COUPON_INVALID')) couponStore.set(null)
  }, [error])
  if (loading && !quote) {
    return (
      <div className="mt-6 space-y-4" aria-busy="true" aria-label="Calculando resumo">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    )
  }
  if (!quote) return error ? <p role="alert" className="mt-6 text-sm text-kurio-coral">{isApiError(error) ? error.message : 'Não foi possível calcular o resumo.'}</p> : null
  return (
    <dl className={cn('mt-6 space-y-3 text-[16px] transition-opacity', refreshing && 'opacity-60')} aria-busy={refreshing} data-testid="quote-summary">
      <Row label="Subtotal" value={formatEth(quote.subtotal)} />
      <Row label={quote.coupon ? `Desconto (${quote.coupon.code}, ${quote.coupon.percentOff}%)` : 'Desconto do lançamento'} value={`(-) ${formatEth(quote.discount, { unit: quote.discount !== '0' })}`} />
      <div>
        <Row label="Taxa de rede" value={formatEth(quote.networkFee)} />
        <p className="text-right text-xs text-primary">Taxa estimada</p>
      </div>
      <div className="flex items-center justify-between pt-3 text-[18px] font-bold">
        <dt>Total</dt>
        <dd className="text-primary" data-testid="quote-total">
          {formatEth(quote.total)}
        </dd>
      </div>
    </dl>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt>{label}</dt>
      <dd className="text-right text-[18px] tabular-nums">{value}</dd>
    </div>
  )
}

function AlsoViewed() {
  const list = useNftList({ tab: 'em-alta', page: 1, pageSize: 5, sort: 'recentes' })
  return (
    <section aria-labelledby="tambem-viram" className="mt-20 hidden md:block">
      <h2 id="tambem-viram" className="border-b border-kurio-line-2 pb-3 text-lg font-bold text-primary">
        Colecionadores também viram
      </h2>
      <div className="mt-8 grid grid-cols-3 gap-6 lg:grid-cols-5">
        {list.isPending ? Array.from({ length: 5 }, (_, i) => <NftCardSkeleton key={i} />) : list.data?.items.map((n) => <NftCard key={n.id} nft={n} />)}
      </div>
    </section>
  )
}

function CartSkeleton() {
  return (
    <div className="mt-2 grid gap-10 lg:grid-cols-[782px_1fr] lg:gap-[86px]" aria-busy="true" aria-label="Carregando carrinho">
      <div className="space-y-3 pt-10">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[70px] w-full rounded-none" />
        ))}
      </div>
      <div className="space-y-4 pt-10">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  )
}
