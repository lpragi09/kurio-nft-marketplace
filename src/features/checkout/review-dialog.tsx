import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import type { Quote, Wallet, WalletConnection } from '@/contracts/api'
import { isApiError } from '@/api/http'
import { formatEth } from '@/lib/eth'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { NETWORK_LABELS } from '@/features/catalog/catalog-search'
import { QuoteBreakdown } from '@/features/cart/cart-page'
import { QuoteLines } from './checkout-page'

const PROVIDERS = { metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase Wallet' } as const

export function ReviewDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  quote: Quote | null
  previousTotal?: string
  reason?: string
  stale: boolean
  onRefresh: () => void
  refreshing: boolean
  onConfirm: () => void
  sending: boolean
  recovering: boolean
  error: unknown
  wallet: Wallet | null
  connection: WalletConnection | null
  buyerName: string
}) {
  const { quote, error } = props
  const blocking = isApiError(error) && (error.code === 'AVAILABILITY_CONFLICT' || error.code === 'WALLET_REJECTED')
  const transient = isApiError(error) && (error.isTransient || error.code === 'INTERNAL')
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-[578px] overflow-y-auto sm:max-w-[578px]">
        <DialogTitle className="text-xl">Revise seu pedido</DialogTitle>
        <DialogDescription className="text-kurio-sand">
          Confira itens, taxas e carteira. Os valores foram revalidados agora pela API.
        </DialogDescription>

        <div aria-live="assertive">
          {props.previousTotal && quote && (
            <p role="alert" className="flex gap-2 rounded border border-primary bg-kurio-band p-3 text-sm" data-testid="quote-changed">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                {props.reason} Total anterior: <s>{formatEth(props.previousTotal)}</s> → novo total: <strong>{formatEth(quote.total)}</strong>. Confirme novamente para continuar.
              </span>
            </p>
          )}
          {props.stale && (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded border border-kurio-coral bg-kurio-band p-3 text-sm" data-testid="quote-stale">
              <AlertTriangle className="size-4 text-kurio-coral" aria-hidden />
              <span className="flex-1">O preço ou a disponibilidade de um item mudou enquanto você revisava. Atualize a cotação para continuar.</span>
              <Button size="sm" onClick={props.onRefresh} disabled={props.refreshing}>
                <RefreshCw className={props.refreshing ? 'animate-spin' : ''} aria-hidden /> Atualizar cotação
              </Button>
            </div>
          )}
          {isApiError(error) && !props.sending && error.code !== 'QUOTE_STALE' && (
            <p role="alert" className="rounded border border-kurio-coral bg-kurio-band p-3 text-sm">
              {error.message}
              {transient && ' Seu pedido não foi duplicado: ao tentar de novo, usaremos a mesma tentativa.'}
            </p>
          )}
          {props.recovering && (
            <p role="status" className="flex items-center gap-2 text-sm text-kurio-sand">
              <Loader2 className="size-4 animate-spin" aria-hidden /> O servidor não respondeu a tempo. Verificando se o pedido foi criado…
            </p>
          )}
        </div>

        {quote && (
          <>
            <QuoteLines quote={quote} />
            <QuoteBreakdown quote={quote} loading={false} error={null} refreshing={props.refreshing} />
          </>
        )}

        <dl className="grid grid-cols-2 gap-2 rounded bg-kurio-bg/50 p-3 text-sm">
          <dt className="text-kurio-sand">Colecionador</dt>
          <dd>{props.buyerName}</dd>
          <dt className="text-kurio-sand">Carteira</dt>
          <dd>
            {props.connection ? PROVIDERS[props.connection.provider] : '—'} · {props.wallet ? `${props.wallet.address.slice(0, 6)}…${props.wallet.address.slice(-4)}` : '—'}
          </dd>
          <dt className="text-kurio-sand">Rede</dt>
          <dd>{quote ? NETWORK_LABELS[quote.network] : '—'}</dd>
        </dl>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => props.onOpenChange(false)} disabled={props.sending}>
            Voltar
          </Button>
          <Button onClick={props.onConfirm} disabled={!quote || props.stale || props.sending || props.refreshing || blocking} className="min-w-[200px]" data-testid="confirm-purchase">
            {props.sending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden /> Enviando pedido…
              </>
            ) : transient ? (
              'Tentar novamente'
            ) : (
              'Confirmar compra'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
