import type { QueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import { mocksReady } from '@/lib/mocks-ready'
import type { Cart, Nft, NftListResponse, Order } from '@/contracts/api'
import {
  SOCKET_URL,
  type ClientToServerEvents,
  type NftUpdatedEvent,
  type OrderUpdatedEvent,
  type ServerToClientEvents,
} from '@/contracts/events'
import { formatEth } from '@/lib/eth'
import { createStore } from '@/lib/store'
import { qk } from '@/queries/client'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline'

export const realtimeStatus = createStore<ConnectionStatus>('idle')

export interface PriceNotice {
  id: string
  nftId: string
  name: string
  message: string
  at: number
}

/** Human-readable notices about cart items changed by `nft.updated` (aria-live in the UI). */
export const priceNotices = createStore<PriceNotice[]>([])

/** Bumped whenever an event touches an NFT; checkout uses it to invalidate its quote. */
export const nftChangeSignal = createStore<{ nftId: string; version: number; editions: NftUpdatedEvent['data']['editions'] } | null>(null)

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/**
 * Owns one socket.io-client connection per session. Applies events idempotently:
 * duplicated event ids and versions older than what the cache holds are ignored.
 */
export class RealtimeClient {
  private socket: TypedSocket | null = null
  private seen = new Set<string>()
  private versions = new Map<string, number>()
  private hasConnectedOnce = false

  constructor(
    private readonly qc: QueryClient,
    private readonly session: { token: string | null; userId: string | null },
  ) {}

  private stopped = false

  async start() {
    realtimeStatus.set('connecting')
    await mocksReady()
    // loaded lazily: engine.io captures the WebSocket constructor when it is evaluated,
    // which must happen after MSW patched it
    const { io } = await import('socket.io-client')
    if (this.stopped) return
    const socket: TypedSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      query: this.session.token ? { token: this.session.token } : {},
      reconnectionDelay: 400,
      reconnectionDelayMax: 3000,
      timeout: 5000,
    })
    this.socket = socket

    socket.on('connect', () => {
      realtimeStatus.set('connected')
      if (this.hasConnectedOnce) this.reconcile()
      this.hasConnectedOnce = true
    })
    socket.on('disconnect', () => realtimeStatus.set('reconnecting'))
    socket.on('connect_error', () => realtimeStatus.set(this.hasConnectedOnce ? 'reconnecting' : 'offline'))
    socket.on('nft.updated', (e) => this.onNftUpdated(e))
    socket.on('order.updated', (e) => this.onOrderUpdated(e))
  }

  stop() {
    this.stopped = true
    if (!this.socket) return
    this.socket.removeAllListeners()
    this.socket.disconnect()
    this.socket = null
    realtimeStatus.set('idle')
  }

  /** After a reconnect, missed events are recovered by refetching active resources via REST. */
  private reconcile() {
    void this.qc.invalidateQueries({ queryKey: ['nfts'], refetchType: 'active' })
    void this.qc.invalidateQueries({ queryKey: ['cart'], refetchType: 'active' })
    if (this.session.userId) {
      void this.qc.invalidateQueries({ queryKey: ['user', this.session.userId, 'orders'], refetchType: 'active' })
    }
  }

  /** returns true when the event must be skipped (duplicate or stale) */
  private shouldSkip(e: { eventId: string; resource: { kind: string; id: string }; version: number }) {
    if (this.seen.has(e.eventId)) return true
    this.seen.add(e.eventId)
    if (this.seen.size > 500) this.seen.delete(this.seen.values().next().value!)
    const key = `${e.resource.kind}:${e.resource.id}`
    const known = this.versions.get(key) ?? 0
    if (e.version <= known) return true
    this.versions.set(key, e.version)
    return false
  }

  private onNftUpdated(e: NftUpdatedEvent) {
    if (this.shouldSkip(e)) return
    const id = e.resource.id

    // detail
    this.qc.setQueryData<Nft>(qk.nftDetail(id), (old) => {
      if (!old || old.version >= e.version) return old
      return {
        ...old,
        price: e.data.price,
        soldOut: e.data.soldOut,
        version: e.version,
        editions: old.editions.map((ed) => {
          const next = e.data.editions.find((x) => x.id === ed.id)
          return next ? { ...ed, price: next.price, available: next.available } : ed
        }),
      }
    })

    // every cached catalog page
    this.qc.setQueriesData<NftListResponse>({ queryKey: ['nfts', 'list'] }, (old) => {
      if (!old?.items.some((n) => n.id === id)) return old
      return {
        ...old,
        items: old.items.map((n) => (n.id === id && n.version < e.version ? { ...n, price: e.data.price, soldOut: e.data.soldOut, version: e.version } : n)),
      }
    })

    // an in-flight request may return data older than this event: refetch it
    for (const q of this.qc.getQueryCache().findAll({ queryKey: ['nfts'] })) {
      if (q.state.fetchStatus === 'fetching') void this.qc.invalidateQueries({ queryKey: q.queryKey, exact: true })
    }

    // carts holding this NFT: tell the user what changed, then let REST recompute totals
    for (const [key, cart] of this.qc.getQueriesData<Cart>({ queryKey: ['cart'] })) {
      if (key.length !== 2 || !cart) continue
      const affected = cart.lines.filter((l) => l.nftId === id && l.nft.version < e.version)
      for (const line of affected) {
        const ed = e.data.editions.find((x) => x.id === line.edition)
        if (!ed) continue
        const parts: string[] = []
        if (ed.price !== line.unitPrice) parts.push(`preço mudou de ${formatEth(line.unitPrice)} para ${formatEth(ed.price)}`)
        if (ed.available === 0) parts.push('a edição esgotou')
        else if (ed.available < line.quantity) parts.push(`restam apenas ${ed.available} unidade(s)`)
        if (parts.length) {
          priceNotices.set((list) => [
            ...list.filter((n) => n.id !== `${line.lineId}`),
            { id: line.lineId, nftId: id, name: `${line.nft.name} (${line.edition})`, message: parts.join(' e '), at: Date.now() },
          ])
        }
      }
      // totals/quotes are always re-read from REST when the cart holds this NFT (even if the
      // cart refetch already carried the new version, its quote may predate it)
      if (cart.lines.some((l) => l.nftId === id)) void this.qc.invalidateQueries({ queryKey: key })
    }
    nftChangeSignal.set({ nftId: id, version: e.version, editions: e.data.editions })
  }

  private onOrderUpdated(e: OrderUpdatedEvent) {
    // events of another (previous) session/user are never applied
    if (!this.session.userId || e.userId !== this.session.userId) return
    if (this.shouldSkip(e)) return
    const key = qk.order(this.session.userId, e.resource.id)
    this.qc.setQueryData<Order>(key, (old) => (old && old.version < e.version ? { ...old, status: e.data.status, version: e.version } : old))
    // fetch the full receipt (tx hash etc.) and refresh the cart (purchased items removed)
    void this.qc.invalidateQueries({ queryKey: key })
    void this.qc.invalidateQueries({ queryKey: qk.pendingOrders(this.session.userId) })
    if (e.data.status === 'confirmed') void this.qc.invalidateQueries({ queryKey: ['cart'] })
  }

  /** test/diagnostic hook */
  get connected() {
    return Boolean(this.socket?.connected)
  }
}
