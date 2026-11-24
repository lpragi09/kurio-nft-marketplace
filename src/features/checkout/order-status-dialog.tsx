import { Link } from '@tanstack/react-router'
import { Loader2, XCircle } from 'lucide-react'
import type { Order } from '@/contracts/api'
import { formatEth } from '@/lib/eth'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

/** Pending / declined states. Confirmed orders navigate to the receipt instead. */
export function OrderStatusDialog({ order, onRetry, onClose }: { order: Order | null; onRetry: () => void; onClose: () => void }) {
  const pending = order?.status === 'pending'
  return (
    <Dialog open={Boolean(order)} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-[460px] text-center sm:max-w-[460px]" showCloseButton={!pending} onEscapeKeyDown={(e) => pending && e.preventDefault()} onPointerDownOutside={(e) => pending && e.preventDefault()}>
        {pending ? (
          <>
            <Loader2 className="mx-auto size-10 animate-spin text-primary" aria-hidden />
            <DialogTitle className="text-xl">Aguardando confirmação na rede</DialogTitle>
            <DialogDescription className="text-kurio-sand" aria-live="polite">
              Pedido {order.id} de {formatEth(order.total)} está pendente. Você pode recarregar a página: o status será recuperado sem criar outra compra.
            </DialogDescription>
          </>
        ) : order ? (
          <>
            <XCircle className="mx-auto size-10 text-kurio-coral" aria-hidden />
            <DialogTitle className="text-xl">Pagamento recusado</DialogTitle>
            <DialogDescription className="text-kurio-sand" role="alert">
              {order.declineReason ?? 'A transação não foi concluída.'} Nenhum valor foi cobrado e seus itens continuam no carrinho.
            </DialogDescription>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button variant="outline" asChild>
                <Link to="/carrinho" onClick={onClose}>
                  Voltar ao carrinho
                </Link>
              </Button>
              <Button onClick={onRetry}>Tentar novamente</Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
