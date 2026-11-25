import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2, Loader2, PlugZap, Unplug } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import type { CreateOrderRequest, Network, Quote, Wallet, WalletConnection, WalletProvider } from '@/contracts/api'
import { buyerSchema, networkSchema, providerSchema } from '@/contracts/schemas'
import { cartApi, walletApi } from '@/api/endpoints'
import { isApiError } from '@/api/http'
import { formatEth } from '@/lib/eth'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { MobileTopBar } from '@/components/layout/mobile-nav'
import { WalletStrip } from '@/components/layout/site-footer'
import { Breadcrumbs } from '@/components/kurio/breadcrumbs'
import { RequiredMark, TextField } from '@/components/kurio/form-field'
import { NftImage } from '@/components/kurio/nft-image'
import { EmptyState, ErrorState } from '@/components/kurio/state-views'
import { NETWORK_LABELS } from '@/features/catalog/catalog-search'
import { CouponField, QuoteBreakdown } from '@/features/cart/cart-page'
import { useWallets } from '@/queries/account'
import { useCart, useCoupon, useQuote } from '@/queries/cart'
import { nftChangeSignal } from '@/realtime/realtime-client'
import { useSession } from '@/session/session-store'
import { checkoutStorage } from './checkout-storage'
import { OrderStatusDialog } from './order-status-dialog'
import { ReviewDialog } from './review-dialog'
import { usePlaceOrder } from './use-place-order'

export const PROVIDER_LABELS: Record<WalletProvider, string> = { metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase Wallet' }

const checkoutFormSchema = buyerSchema.extend({
  network: networkSchema,
  provider: providerSchema,
  walletId: z.string().min(1, 'Selecione uma carteira cadastrada.'),
  useSecondary: z.boolean(),
})
export type CheckoutForm = z.infer<typeof checkoutFormSchema>

export function CheckoutPage() {
  const { user } = useSession()
  const cart = useCart()
  const wallets = useWallets()
  if (!user) return null
  if (cart.isPending || wallets.isPending) return <CheckoutSkeleton />
  if (cart.isError) return <Wrap><ErrorState error={cart.error} onRetry={() => cart.refetch()} /></Wrap>
  if (wallets.isError) return <Wrap><ErrorState error={wallets.error} onRetry={() => wallets.refetch()} /></Wrap>
    // sold-out lines keep the cart "non-empty": the user must see why the purchase was blocked
  return <Checkout userId={user.id} wallets={wallets.data} cartEmpty={cart.data.lines.length === 0} />
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1200px] px-6 py-10 xl:px-0">{children}</div>
}

function Checkout({ userId, wallets, cartEmpty }: { userId: string; wallets: Wallet[]; cartEmpty: boolean }) {
  const { user } = useSession()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const coupon = useCoupon()
  const draft = useMemo(() => checkoutStorage.getDraft(), [])
  const primary = wallets.find((w) => w.slot === 'primary')
  const secondary = wallets.find((w) => w.slot === 'secondary')

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutFormSchema),
    mode: 'onTouched',
    defaultValues: {
      displayName: draft?.buyer.displayName ?? user?.displayName ?? '',
      username: draft?.buyer.username ?? user?.username ?? '',
      profileName: draft?.buyer.profileName ?? primary?.profileName ?? '',
      email: draft?.buyer.email ?? user?.email ?? '',
      ensName: draft?.buyer.ensName ?? user?.ensName ?? '',
      referralCode: draft?.buyer.referralCode ?? primary?.referralCode ?? '',
      note: draft?.buyer.note ?? '',
      network: draft?.network ?? primary?.network ?? 'ethereum',
      provider: draft?.provider ?? primary?.provider ?? 'metamask',
      walletId: draft?.walletId ?? primary?.id ?? '',
      useSecondary: Boolean(draft?.walletId && draft.walletId === secondary?.id),
    },
  })
  const values = form.watch()
  const selectedWallet = wallets.find((w) => w.id === values.walletId) ?? null

  // persist the draft so an expired session / refresh resumes the checkout
  useEffect(() => {
    const { network, provider, walletId, useSecondary: _u, ...buyer } = values
    checkoutStorage.setDraft({ buyer, network, provider, walletId })
  }, [values])

  const quote = useQuote({ network: values.network })

  /* ───── simulated wallet connection ───── */
  const [connection, setConnection] = useState<WalletConnection | null>(() => checkoutStorage.getConnection(userId))
  const saveConnection = (c: WalletConnection | null) => {
    checkoutStorage.setConnection(userId, c)
    setConnection(c)
  }
  const connect = useMutation({
    mutationFn: () => walletApi.connect({ provider: values.provider, network: values.network, walletId: values.walletId }),
    onSuccess: (c) => {
      saveConnection(c)
      toast.success(`${PROVIDER_LABELS[c.provider]} conectada na rede ${NETWORK_LABELS[c.network]}.`)
    },
  })
  const disconnect = useMutation({
    mutationFn: (id: string) => walletApi.disconnect(id),
    onSettled: () => saveConnection(null),
  })
  // a connection is bound to wallet+provider+network: changing any of them disconnects
  useEffect(() => {
    if (connection && (connection.walletId !== values.walletId || connection.provider !== values.provider || connection.network !== values.network)) {
      disconnect.mutate(connection.connectionId)
      toast.info('Carteira desconectada porque a carteira, o tipo ou a rede mudaram.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.walletId, values.provider, values.network])

  /* ───── review + order ───── */
  const placer = usePlaceOrder(userId)
  const [review, setReview] = useState<{ quote: Quote; previousTotal?: string; reason?: string } | null>(null)
  const [stale, setStale] = useState(false)
  const signal = useStore(nftChangeSignal)

  // realtime: any nft.updated touching a quoted line makes the review quote stale
  useEffect(() => {
    // our own order reserves stock (and emits nft.updated): ignore events while placing it
    if (!review || !signal || placer.sending || placer.attempt?.orderId) return
    for (const line of review.quote.lines.filter((l) => l.nftId === signal.nftId && signal.version > l.nftVersion)) {
      const ed = signal.editions.find((e) => e.id === line.edition)
      if (!ed || ed.price !== line.unitPrice || ed.available < line.quantity) setStale(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal, review])

  const fetchQuote = useMutation({
    mutationFn: () => cartApi.quote({ couponCode: coupon ?? undefined, network: values.network }),
  })

  const openReview = form.handleSubmit(async () => {
    if (!connection) {
      form.setError('walletId', { type: 'manual', message: 'Conecte a carteira antes de revisar o pedido.' })
      document.getElementById('carteira-e-rede')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    try {
      const fresh = await fetchQuote.mutateAsync()
      const shown = quote.data
      setStale(false)
      setReview({
        quote: fresh,
        previousTotal: shown && shown.total !== fresh.total ? shown.total : undefined,
        reason: shown && shown.total !== fresh.total ? 'Os valores mudaram desde que você abriu a página.' : undefined,
      })
      void qc.invalidateQueries({ queryKey: ['cart'] })
    } catch (e) {
      toast.error(isApiError(e) ? e.message : 'Não foi possível revisar o pedido.')
    }
  })

  const refreshReview = async () => {
    if (!review) return
    const fresh = await fetchQuote.mutateAsync()
    setReview({ quote: fresh, previousTotal: fresh.total !== review.quote.total ? review.quote.total : undefined, reason: 'Cotação atualizada com os valores atuais.' })
    setStale(false)
  }

  const confirm = async () => {
    if (!review || !connection || stale) return
    const v = form.getValues()
    const body: CreateOrderRequest = {
      quoteId: review.quote.id,
      expectedTotal: review.quote.total,
      connectionId: connection.connectionId,
      walletId: v.walletId,
      network: v.network,
      buyer: { displayName: v.displayName, username: v.username, profileName: v.profileName, email: v.email, ensName: v.ensName, referralCode: v.referralCode, note: v.note || undefined },
    }
    await placer.place(body)
  }

  // react to order creation errors (stale quote, availability, wallet)
  useEffect(() => {
    const e = placer.error
    if (!isApiError(e)) return
    if (e.code === 'QUOTE_STALE') {
      const fresh = (e.details as { quote?: Quote } | undefined)?.quote
      if (fresh && review) {
        setReview({ quote: fresh, previousTotal: review.quote.total, reason: e.message })
        setStale(false)
      } else setStale(true)
      void qc.invalidateQueries({ queryKey: ['cart'] })
    } else if (e.code === 'AVAILABILITY_CONFLICT') {
      void qc.invalidateQueries({ queryKey: ['cart'] })
      void qc.invalidateQueries({ queryKey: ['nfts'] })
    } else if (e.code === 'WALLET_REJECTED') {
      saveConnection(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placer.error])

  // once an order exists, the review dialog gives way to the status dialog
  const order = placer.order
  useEffect(() => {
    if (order) setReview(null)
    if (order?.status === 'confirmed') {
      checkoutStorage.clearAttempt()
      void qc.invalidateQueries({ queryKey: ['cart'] })
      void navigate({ to: '/pedido/$orderId', params: { orderId: order.id }, replace: true })
    }
  }, [order, navigate, qc])

  const unresolvedAttempt = placer.attempt && !placer.attempt.orderId && !placer.sending

  if (cartEmpty && !placer.attempt) {
    return (
      <Wrap>
        <EmptyState
          title="Seu carrinho está vazio"
          action={
            <Link to="/" hash="catalogo" className="rounded bg-primary px-6 py-2.5 font-bold text-kurio-bg">
              Explorar NFTs
            </Link>
          }
        >
          Adicione NFTs antes de seguir para o pagamento.
        </EmptyState>
      </Wrap>
    )
  }

  const { errors } = form.formState
  return (
    <>
      <MobileTopBar title="Pagamento com carteira" back="/carrinho" />
      <div className="mx-auto max-w-[1200px] px-6 xl:px-0">
        <Breadcrumbs className="hidden md:flex" items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/', hash: 'catalogo' }, { label: 'Pagamento' }]} />
        <h1 className="sr-only">Pagamento</h1>

        {unresolvedAttempt && (
          <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded border border-primary/60 bg-kurio-band px-4 py-3 text-sm">
            <AlertTriangle className="size-4 text-primary" aria-hidden />
            <span className="flex-1">Uma tentativa de compra anterior ficou sem resposta do servidor. Verifique antes de comprar de novo — ela não será duplicada.</span>
            <Button size="sm" onClick={() => placer.resume()} disabled={placer.recovering}>
              {placer.recovering ? 'Verificando…' : 'Verificar pedido'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => placer.reset()}>
              Descartar
            </Button>
          </div>
        )}

        <form noValidate onSubmit={openReview} className="mt-8 grid gap-10 lg:grid-cols-[763px_1fr] lg:gap-[37px]">
          <section aria-labelledby="perfil-colecionador" className="order-2 lg:order-1">
            <h2 id="perfil-colecionador" className="text-[18px] font-bold">
              Perfil do colecionador
            </h2>
            <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <TextField label="Nome de exibição" required autoComplete="name" error={errors.displayName?.message} {...form.register('displayName')} />
              <TextField label="Nome de usuário" required autoComplete="username" error={errors.username?.message} {...form.register('username')} />
              <SelectField label="Rede" required error={errors.network?.message} control={form.control} name="network" placeholder="Selecione uma rede" options={Object.entries(NETWORK_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
              <TextField label="Nome do perfil" required error={errors.profileName?.message} {...form.register('profileName')} />
              <TextField label="Endereço da carteira" required readOnly value={selectedWallet?.address ?? ''} placeholder="Endereço 0x da carteira" hint="Definido pela carteira selecionada." />
              <TextField label="ENS ou carteira secundária (opcional)" hideLabel={false} readOnly value={selectedWallet?.secondaryAddress ?? ''} placeholder="ENS ou carteira secundária (opcional)" />
              <SelectField label="Tipo de carteira" required error={errors.provider?.message} control={form.control} name="provider" placeholder="Selecione uma carteira" options={Object.entries(PROVIDER_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
              <TextField label="Código de indicação" required error={errors.referralCode?.message} {...form.register('referralCode')} />
              <TextField label="E-mail" required type="email" autoComplete="email" error={errors.email?.message} {...form.register('email')} />
              <EnsField register={form.register('ensName')} error={errors.ensName?.message} />
            </div>
            <label className="mt-6 inline-flex items-center gap-2 text-[15px]">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                disabled={!secondary}
                checked={values.useSecondary}
                onChange={(e) => {
                  form.setValue('useSecondary', e.target.checked)
                  const w = e.target.checked ? secondary : primary
                  if (w) form.setValue('walletId', w.id, { shouldValidate: true })
                }}
              />
              Usar outra carteira?{!secondary && <span className="text-xs text-kurio-khaki"> (cadastre uma carteira secundária)</span>}
            </label>
            <div className="mt-6">
              <label htmlFor="note" className="text-[15px]">
                Observação do colecionador (opcional)
              </label>
              <Textarea id="note" className="mt-2 h-[150px] max-w-[350px]" aria-invalid={Boolean(errors.note)} {...form.register('note')} />
              {errors.note && <p role="alert" className="mt-1 text-xs text-kurio-coral">{errors.note.message}</p>}
            </div>
          </section>

          <aside aria-label="Resumo e carteira" className="order-1 lg:order-2">
            <div className="hidden lg:block">
              <h2 className="text-[18px] font-bold">Seus NFTs</h2>
              <QuoteLines quote={quote.data} />
              <p className="mt-4 text-center text-[15px]">Tem um código promocional? Aplique aqui</p>
              <CouponField />
              <QuoteBreakdown quote={quote.data} loading={quote.isPending && quote.fetchStatus !== 'idle'} error={quote.isError ? quote.error : null} refreshing={quote.isFetching && !quote.isPending} />
            </div>

            <WalletPicker
              wallets={wallets}
              selected={values.walletId}
              onSelect={(id) => {
                form.setValue('walletId', id, { shouldValidate: true })
                form.setValue('useSecondary', id === secondary?.id)
              }}
              provider={values.provider}
              onProvider={(p) => form.setValue('provider', p, { shouldValidate: true })}
              connection={connection}
              connecting={connect.isPending}
              connectError={connect.error}
              onConnect={() => connect.mutate()}
              onDisconnect={() => connection && disconnect.mutate(connection.connectionId)}
              error={errors.walletId?.message}
            />

            <p className="mt-6 flex items-center justify-between text-[18px] font-bold lg:hidden">
              Total: <span className="text-primary">{quote.data ? formatEth(quote.data.total) : '—'}</span>
            </p>
            <Button type="submit" className="mt-6 h-11 w-full text-[16px] max-md:h-[60px] max-md:rounded-[37px]" disabled={fetchQuote.isPending || !quote.data || placer.sending}>
              {fetchQuote.isPending ? 'Atualizando cotação…' : 'Revisar e confirmar compra'}
            </Button>
          </aside>
        </form>
      </div>

      <ReviewDialog
        open={Boolean(review)}
        onOpenChange={(o) => !o && !placer.sending && setReview(null)}
        quote={review?.quote ?? null}
        previousTotal={review?.previousTotal}
        reason={review?.reason}
        stale={stale}
        onRefresh={refreshReview}
        refreshing={fetchQuote.isPending}
        onConfirm={confirm}
        sending={placer.sending}
        recovering={placer.recovering}
        error={placer.error}
        wallet={selectedWallet}
        connection={connection}
        buyerName={values.displayName}
      />
      <OrderStatusDialog
        order={order && order.status !== 'confirmed' ? order : null}
        onRetry={() => placer.reset()}
        onClose={() => placer.reset()}
      />
    </>
  )
}

function EnsField({ register, error }: { register: ReturnType<ReturnType<typeof useForm<CheckoutForm>>['register']>; error?: string }) {
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex text-[15px]">
        <label htmlFor="ensName">Nome ENS</label>
        <RequiredMark />
      </div>
      <div className="flex gap-2.5">
        <input
          id="ensName"
          aria-invalid={Boolean(error)}
          aria-required
          aria-describedby={error ? 'ensName-error' : undefined}
          className={cn('h-10 min-w-0 flex-1 rounded-[4px] border border-kurio-line-2 bg-kurio-bg/40 px-3 text-[15px] focus:border-primary focus:outline-none', error && 'border-kurio-coral')}
          {...register}
        />
        <span className="inline-flex h-10 items-center rounded-[4px] border border-kurio-line-2 px-3 text-[15px]">.eth</span>
      </div>
      {error && (
        <p id="ensName-error" role="alert" className="mt-1 text-xs text-kurio-coral">
          {error}
        </p>
      )}
    </div>
  )
}

function SelectField({
  label,
  required,
  error,
  control,
  name,
  options,
  placeholder,
}: {
  label: string
  required?: boolean
  error?: string
  control: ReturnType<typeof useForm<CheckoutForm>>['control']
  name: 'network' | 'provider'
  options: { value: string; label: string }[]
  placeholder: string
}) {
  const id = `field-${name}`
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex text-[15px]">
        <label htmlFor={id}>{label}</label>
        {required && <RequiredMark />}
      </div>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id={id} className="w-full" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-kurio-coral">
          {error}
        </p>
      )}
    </div>
  )
}

export function QuoteLines({ quote }: { quote?: Quote }) {
  if (!quote) return null
  return (
    <table className="mt-3 w-full border-separate border-spacing-y-3 text-left">
      <thead>
        <tr className="text-[16px]">
          <th scope="col" className="border-b border-kurio-line-2 pb-2 font-bold">NFTs</th>
          <th scope="col" className="border-b border-kurio-line-2 pb-2 text-right font-bold">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {quote.lines.map((l) => (
          <tr key={l.lineId} className="bg-kurio-surface">
            <td className="p-1">
              <div className="flex items-center gap-3">
                <NftImage base={l.image} alt="" decorative sizes="66px" className="size-[66px] rounded" />
                <div>
                  <p className="text-[16px] font-bold">{l.name}</p>
                  <p className="text-[14px] text-kurio-sand">
                    ID do token: {l.tokenId} <span className="ml-2">(x {l.quantity})</span>
                  </p>
                </div>
              </div>
            </td>
            <td className="pr-3 text-right text-[18px] font-bold text-primary">{formatEth(l.lineTotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function WalletPicker(props: {
  wallets: Wallet[]
  selected: string
  onSelect: (id: string) => void
  provider: WalletProvider
  onProvider: (p: WalletProvider) => void
  connection: WalletConnection | null
  connecting: boolean
  connectError: unknown
  onConnect: () => void
  onDisconnect: () => void
  error?: string
}) {
  const { wallets, connection } = props
  return (
    <section id="carteira-e-rede" aria-labelledby="carteira-titulo" className="mt-8 scroll-mt-24">
      <div className="flex items-center justify-between">
        <h2 id="carteira-titulo" className="text-[18px] font-bold">
          Carteira e rede
        </h2>
        <Link to="/perfil/carteiras" className="text-sm font-bold text-primary hover:underline">
          Gerenciar carteiras
        </Link>
      </div>
      {wallets.length === 0 ? (
        <p className="mt-3 rounded border border-dashed border-kurio-line-2 p-4 text-sm">
          Você ainda não cadastrou carteiras.{' '}
          <Link to="/perfil/carteiras" className="font-bold text-primary underline">
            Cadastrar carteira
          </Link>
        </p>
      ) : (
        <fieldset className="mt-3 space-y-3">
          <legend className="sr-only">Carteira cadastrada</legend>
          {wallets.map((w) => (
            <label key={w.id} className={cn('flex cursor-pointer items-center gap-4 rounded-[10px] bg-kurio-surface px-5 py-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring', props.selected === w.id && 'ring-1 ring-primary')}>
              <input type="radio" name="wallet" className="size-4 accent-[var(--primary)]" checked={props.selected === w.id} onChange={() => props.onSelect(w.id)} />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold">{w.slot === 'primary' ? 'Principal' : 'Reserva'} · {w.nickname}</span>
                <span className="block truncate text-sm text-kurio-sand">{w.address.slice(0, 6)}…{w.address.slice(-4)}</span>
                <span className="block text-sm text-kurio-sand">Rede {NETWORK_LABELS[w.network]}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <fieldset className="mt-4 space-y-3">
        <legend className="mb-2 text-[15px] font-bold">Conectar com</legend>
        <div className="flex items-center gap-3 rounded border border-kurio-line-2 px-4 py-3">
          <WalletStrip />
        </div>
        {(Object.keys(PROVIDER_LABELS) as WalletProvider[]).map((p) => (
          <label key={p} className={cn('flex cursor-pointer items-center gap-3 rounded border px-4 py-3 text-[15px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring', props.provider === p ? 'border-primary' : 'border-kurio-line-2')}>
            <input type="radio" name="provider" className="size-4 accent-[var(--primary)]" checked={props.provider === p} onChange={() => props.onProvider(p)} />
            {PROVIDER_LABELS[p]}
          </label>
        ))}
      </fieldset>

      <div className="mt-4" aria-live="polite">
        {connection ? (
          <div className="flex items-center justify-between gap-3 rounded border border-kurio-success/60 px-4 py-3 text-sm" data-testid="wallet-connected">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-kurio-success" aria-hidden />
              Conectada: {PROVIDER_LABELS[connection.provider]} · {connection.address.slice(0, 6)}…{connection.address.slice(-4)} · {NETWORK_LABELS[connection.network]}
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={props.onDisconnect}>
              <Unplug aria-hidden /> Desconectar
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" className="w-full" onClick={props.onConnect} disabled={props.connecting || !props.selected}>
            {props.connecting ? <Loader2 className="animate-spin" aria-hidden /> : <PlugZap aria-hidden />}
            {props.connecting ? 'Aguardando aprovação na carteira…' : 'Conectar carteira'}
          </Button>
        )}
        {isApiError(props.connectError) && !connection && (
          <p role="alert" className="mt-2 text-sm text-kurio-coral">
            {props.connectError.message} Tente novamente ou escolha outra carteira.
          </p>
        )}
        {props.error && (
          <p role="alert" className="mt-2 text-sm text-kurio-coral">
            {props.error}
          </p>
        )}
      </div>
    </section>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="mx-auto max-w-[1200px] px-6 pt-16 xl:px-0" aria-busy="true" aria-label="Carregando pagamento">
      <div className="grid gap-10 lg:grid-cols-[763px_1fr]">
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="shimmer h-[70px] rounded" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="shimmer h-12 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}

export type { Network }
