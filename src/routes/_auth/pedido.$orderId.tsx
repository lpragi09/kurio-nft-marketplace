import { createFileRoute } from '@tanstack/react-router'
import { OrderPage } from '@/features/order/order-page'

export const Route = createFileRoute('/_auth/pedido/$orderId')({
  component: OrderPage,
})
