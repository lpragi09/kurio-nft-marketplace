import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ExternalLink, Loader2, X, XCircle } from 'lucide-react'
import type { Order } from '@/contracts/api'
import { orderApi } from '@/api/endpoints'
import { isApiError } from '@/api/http'
import { formatEth } from '@/lib/eth'
import { useStore } from '@/lib/store'
import { Skeleton } from '@/components/ui/skeleton'
import { NftImage } from '@/components/kurio/nft-image'
import { EmptyState, ErrorState } from '@/components/kurio/state-views'
import { NETWORK_LABELS } from '@/features/catalog/catalog-search'
import { qk } from '@/queries/client'
import { realtimeStatus } from '@/realtime/realtime-client'
import { useSession } from '@/session/session-store'
import thankYou from '@/assets/thank-you.svg'

const route = getRouteApi('/_auth/pedido/$orderId')
const PROVIDERS = { metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase Wallet' } as const

export function OrderPage() {
  const { orderId } = route.useParams()
  const { user } = useSession()
  const socket = useStore(realtimeStatus)
  const order = useQuery({
    queryKey: qk.order(user!.id, orderId),
    queryFn: ({ signal }) => orderApi.get(orderId, { signal }),
    // primary updates come from `order.updated`; poll only while the socket is down
    refetchInterval: (q) => (q.state.data?.status === 'pending' && socket !== 'connected' ? 3000 : false),
  })

  return (
    <div className="px-4 py-10 md:py-20">
      {order.isPending ? (
        <Card>
          <div className="space-y-4 p-8" aria-busy="true" aria-label="Carregando pedido">
            <Skeleton className="mx-auto size-20 rounded-full" />
            <Skeleton className="mx-auto h-5 w-2/3" />
            <Skeleton className="h-14 w-full" />
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[66px] w-full" />
            ))}
          </div>
        </Card>
      ) : order.isError ? (
        <div className="mx-auto max-w-[578px]">
          {isApiError(order.error) && order.error.status === 404 ? (
            <EmptyState title="Pedido não encontrado">Verifique o link ou acesse seus pedidos pela conta.</EmptyState>
          ) : isApiError(order.error) && order.error.status === 403 ? (
            <EmptyState title="Acesso negado">Este pedido pertence a outra conta.</EmptyState>
          ) : (
            <ErrorState error={order.error} onRetry={() => order.refetch()} retrying={order.isFetching} />
          )}
        </div>
      ) : order.data.status === 'confirmed' ? (
        <Receipt order={order.data} />
      ) : order.data.status === 'pending' ? (
        <Card>
          <div className="flex flex-col items-center gap-4 p-10 text-center" role="status" aria-live="polite">
            <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
            <h1 className="text-xl font-bold">Pedido pendente</h1>
            <p className="text-sm text-kurio-sand">Aguardando a confirmação da transação na rede. Esta página atualiza sozinha.</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex flex-col items-center gap-4 p-10 text-center" role="alert">
            <XCircle className="size-10 text-kurio-coral" aria-hidden />
            <h1 className="text-xl font-bold">Pagamento recusado</h1>
            <p className="text-sm text-kurio-sand">{order.data.declineReason} Seus itens continuam no carrinho.</p>
            <Link to="/carrinho" className="rounded bg-primary px-6 py-2.5 font-bold text-kurio-bg">
              Voltar ao carrinho
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="relative mx-auto max-w-[578px] border-b-[10px] border-primary bg-kurio-surface">{children}</section>
}

/** Renders the immutable order snapshot returned by the API — never the live catalog. */
function Receipt({ order }: { order: Order }) {
  const date = new Date(order.settledAt ?? order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  const short = (h: string | null) => (h ? `${h.slice(0, 6)}…${h.slice(-4)}` : '—')
  return (
    <Card>
      <Link to="/" aria-label="Fechar e voltar ao início" className="absolute right-5 top-5 text-primary hover:text-kurio-orange-light">
        <X className="size-5" aria-hidden />
      </Link>
      <header className="flex flex-col items-center gap-4 border-b border-primary px-6 pb-5 pt-5">
        <img src={thankYou} alt="" width={80} height={80} />
        <h1 className="text-center text-[16px] font-bold text-kurio-sand">Seus NFTs agora estão na sua carteira</h1>
      </header>
      <dl className="grid grid-cols-2 gap-y-3 border-b border-primary px-6 py-4 text-[15px] sm:grid-cols-4 sm:divide-x sm:divide-primary">
        <Meta label="ID da transação" value={short(order.txHash)} strong />
        <Meta label="Data" value={date} />
        <Meta label="Total" value={formatEth(order.total)} />
        <Meta label="Carteira" value={PROVIDERS[order.walletProvider]} strong />
      </dl>
      <div className="px-6 py-5 sm:px-11">
        <h2 className="text-[15px] font-bold">Detalhes da transação</h2>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-[16px]">
              <th scope="col" className="border-b border-kurio-line-2 pb-2 font-normal">NFTs</th>
              <th scope="col" className="border-b border-kurio-line-2 pb-2 text-center font-normal">Edições</th>
              <th scope="col" className="border-b border-kurio-line-2 pb-2 text-right font-normal">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l) => (
              <tr key={`${l.nftId}:${l.edition}`}>
                <td className="py-2">
                  <div className="flex items-center gap-3">
                    <NftImage base={l.image} alt="" decorative sizes="70px" className="size-[66px] rounded" />
                    <div>
                      <p className="text-[16px] font-bold">{l.name}</p>
                      <p className="text-[14px] text-kurio-sand">ID do token: {l.tokenId} · {l.edition}</p>
                    </div>
                  </div>
                </td>
                <td className="text-center text-[15px]">(x {l.quantity})</td>
                <td className="text-right text-[18px] font-bold text-primary">{formatEth(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-4 space-y-2 border-b border-kurio-line-2 pb-3 text-[15px]">
          {order.discount !== '0' && (
            <div className="flex justify-between">
              <dt>Desconto {order.coupon ? `(${order.coupon})` : ''}</dt>
              <dd>(-) {formatEth(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Taxa de rede</dt>
            <dd className="text-[18px]">{formatEth(order.networkFee)}</dd>
          </div>
          <div className="flex justify-between font-bold">
            <dt>Total</dt>
            <dd className="text-[18px] text-primary" data-testid="receipt-total">{formatEth(order.total)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-center text-[14px] leading-[22px] text-kurio-sand">
          Transação confirmada na {NETWORK_LABELS[order.network]}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
        </p>
        <p className="mt-1 text-center text-xs text-kurio-khaki">Pedido {order.id} · referências de transação simuladas.</p>
        <div className="mt-5 flex justify-center pb-6">
          <a
            href={order.explorerUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center gap-2 rounded bg-primary px-4 text-[16px] font-bold text-kurio-bg hover:bg-kurio-orange-light"
          >
            Ver no Etherscan <ExternalLink className="size-4" aria-hidden />
            <span className="sr-only">(abre em nova aba; transação simulada)</span>
          </a>
        </div>
      </div>
    </Card>
  )
}

function Meta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="sm:px-3 sm:first:pl-0">
      <dt className={strong ? 'font-bold text-kurio-sand' : 'text-kurio-sand'}>{label}</dt>
      <dd className="text-kurio-sand">{value}</dd>
    </div>
  )
}
