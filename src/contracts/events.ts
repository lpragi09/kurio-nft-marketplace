import type { EditionId, EthAmount, OrderStatus } from './api'

/**
 * Socket.IO event envelopes. Every event carries a stable id (for de-duplication),
 * the affected resource and its version (for ordering).
 */
export interface EventEnvelope<TType extends string, TData> {
  eventId: string
  type: TType
  resource: { kind: 'nft' | 'order'; id: string }
  version: number
  occurredAt: string
  /** present on user-scoped events; the client drops events for any other user */
  userId?: string
  data: TData
}

export interface NftUpdatedData {
  price: EthAmount
  soldOut: boolean
  editions: { id: EditionId; price: EthAmount; available: number }[]
}

export interface OrderUpdatedData {
  status: OrderStatus
}

export type NftUpdatedEvent = EventEnvelope<'nft.updated', NftUpdatedData>
export type OrderUpdatedEvent = EventEnvelope<'order.updated', OrderUpdatedData>

export interface ServerToClientEvents {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
}

export interface ClientToServerEvents {
  'order.watch': (orderId: string) => void
}

export const SOCKET_URL = 'wss://realtime.kurio.test'
