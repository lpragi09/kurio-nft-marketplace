import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type { Nft, Order } from '@/contracts/api'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/contracts/events'
import { db, scenario } from './db'

/**
 * Socket.IO server simulated with MSW's WebSocket interception and the
 * @mswjs/socket.io-binding encoder. The client is the real `socket.io-client`
 * (websocket transport); this module only speaks the Engine.IO/Socket.IO wire protocol.
 */

type Io = ReturnType<typeof toSocketIo>

interface LiveConnection {
  id: string
  userId: string | null
  io: Io
  close: () => void
}

const connections = new Map<string, LiveConnection>()
let connectionSeq = 0

// MSW strips the /socket.io/ prefix before matching, so match the whole host.
const realtime = ws.link('wss://realtime.kurio.test/*')

export const realtimeHandlers = [
  realtime.addEventListener('connection', (connection) => {
    // Offline scenario → refuse the socket; socket.io-client will keep retrying.
    if (scenario.offline) {
      connection.client.close(1011, 'offline')
      return
    }

    const url = new URL(connection.client.url)
    const token = url.searchParams.get('token')
    const session = token ? db.sessions[token] : undefined
    const userId = session && session.expiresAt > Date.now() ? session.userId : null

    const io = toSocketIo(connection)
    const id = `c${++connectionSeq}`

    // The binding answers the Engine.IO handshake with pingInterval=25s; keep the
    // client alive by sending Engine.IO pings ("2") like a real server would.
    const ping = setInterval(() => connection.client.send('2'), 20_000)

    const live: LiveConnection = {
      id,
      userId,
      io,
      close: () => connection.client.close(),
    }
    connections.set(id, live)

    connection.client.addEventListener('close', () => {
      clearInterval(ping)
      connections.delete(id)
    })
  }),
]

function deliver(targets: LiveConnection[], type: 'nft.updated' | 'order.updated', event: NftUpdatedEvent | OrderUpdatedEvent) {
  for (const c of targets) {
    c.io.client.emit(type, event)
    if (scenario.realtime.duplicateEvents) {
      // exact duplicate + an older version of the same resource
      c.io.client.emit(type, event)
      c.io.client.emit(type, { ...event, eventId: `${event.eventId}-stale`, version: Math.max(0, event.version - 1) })
    }
  }
}

let eventSeq = 0
const newEventId = () => `evt_${Date.now().toString(36)}_${(++eventSeq).toString(36)}`

export function publishNftUpdated(nft: Nft) {
  const event: NftUpdatedEvent = {
    eventId: newEventId(),
    type: 'nft.updated',
    resource: { kind: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: new Date().toISOString(),
    data: {
      price: nft.price,
      soldOut: nft.soldOut,
      editions: nft.editions.map((e) => ({ id: e.id, price: e.price, available: e.available })),
    },
  }
  deliver([...connections.values()], 'nft.updated', event)
}

export function publishOrderUpdated(order: Order & { userId: string }) {
  const event: OrderUpdatedEvent = {
    eventId: newEventId(),
    type: 'order.updated',
    resource: { kind: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date().toISOString(),
    userId: order.userId,
    data: { status: order.status },
  }
  // Only the owner's authenticated sockets receive order events.
  deliver(
    [...connections.values()].filter((c) => c.userId === order.userId),
    'order.updated',
    event,
  )
}

/** Simulates a server-side drop of every live socket (clients auto-reconnect). */
export function dropAllSockets() {
  for (const c of connections.values()) c.close()
  connections.clear()
}

export function liveSocketCount() {
  return connections.size
}
