import type {
  Cart,
  CartLine,
  CartLineInput,
  EditionId,
  Network,
  Nft,
  NftSummary,
  Quote,
  User,
} from '@/contracts/api'
import { compareEth, eth, mulEth, percentOf, subEth, sumEth } from '@/lib/eth'
import { db, nextId, persist, scenario, type CartRecord, type OrderRecord, type QuoteRecord } from './db'
import { COUPONS, NETWORK_FEES, type UserRecord } from './fixtures'
import { publishNftUpdated, publishOrderUpdated } from './realtime'

export class ServiceError extends Error {
  status: number
  code: string
  fields?: Record<string, string>
  details?: unknown
  constructor(status: number, code: string, message: string, extra: { fields?: Record<string, string>; details?: unknown } = {}) {
    super(message)
    this.status = status
    this.code = code
    this.fields = extra.fields
    this.details = extra.details
  }
}

/* ───────── auth ───────── */

export async function hashPassword(salt: string, password: string) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function publicUser(u: UserRecord): User {
  const { passwordHash: _h, passwordSalt: _s, ...user } = u
  return user
}

export function createSession(userId: string) {
  const token = `tok_${crypto.randomUUID().replace(/-/g, '')}`
  const expiresAt = Date.now() + scenario.sessionTtlSeconds * 1000
  db.sessions[token] = { userId, expiresAt }
  persist()
  return { token, expiresAt: new Date(expiresAt).toISOString(), user: publicUser(db.users[userId]!) }
}

/** Resolves the bearer token; throws 401 UNAUTHENTICATED / SESSION_EXPIRED. */
export function requireUser(request: Request): UserRecord {
  const user = optionalUser(request)
  if (!user) throw new ServiceError(401, 'UNAUTHENTICATED', 'Faça login para continuar.')
  return user
}

export function optionalUser(request: Request): UserRecord | null {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7)
  const session = db.sessions[token]
  if (!session) throw new ServiceError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
  if (session.expiresAt <= Date.now()) {
    delete db.sessions[token]
    persist()
    throw new ServiceError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
  }
  return db.users[session.userId] ?? null
}

/* ───────── nfts ───────── */

export function toSummary(n: Nft): NftSummary {
  return {
    id: n.id,
    tokenId: n.tokenId,
    name: n.name,
    image: n.image,
    imageAlt: n.imageAlt,
    category: n.category,
    network: n.network,
    price: n.price,
    compareAtPrice: n.compareAtPrice,
    rarity: n.rarity,
    listedAt: n.listedAt,
    trendingScore: n.trendingScore,
    soldOut: n.soldOut,
    version: n.version,
  }
}

/** Mutates an NFT (price / availability), bumps its version and emits `nft.updated`. */
export function updateNft(
  id: string,
  patch: { price?: string; edition?: EditionId; available?: number; editionPrice?: string },
) {
  const nft = db.nfts[id]
  if (!nft) throw new ServiceError(404, 'NOT_FOUND', 'NFT não encontrado.')
  if (patch.price !== undefined) {
    // re-price every edition proportionally to the default (1/50) edition
    const base = nft.editions.find((e) => e.id === '1/50')!.price
    const ratio = eth(patch.price).div(base)
    nft.editions = nft.editions.map((e) => ({ ...e, price: eth(e.price).times(ratio).round(2).toString() }))
    nft.price = patch.price
  }
  if (patch.edition) {
    nft.editions = nft.editions.map((e) =>
      e.id === patch.edition
        ? { ...e, available: patch.available ?? e.available, price: patch.editionPrice ?? e.price }
        : e,
    )
    if (patch.edition === '1/50' && patch.editionPrice) nft.price = patch.editionPrice
  }
  nft.soldOut = nft.editions.every((e) => e.available === 0)
  nft.version += 1
  persist()
  publishNftUpdated(nft)
  return nft
}

/* ───────── cart ───────── */

export function cartKey(request: Request): { cart: CartRecord; user: UserRecord | null } {
  const user = optionalUser(request)
  if (user) {
    let id = db.userCart[user.id]
    if (!id || !db.carts[id]) {
      id = nextId('cart')
      db.carts[id] = { id, userId: user.id, lines: [], version: 1, updatedAt: new Date().toISOString() }
      db.userCart[user.id] = id
      persist()
    }
    return { cart: db.carts[id]!, user }
  }
  const guestId = request.headers.get('x-guest-cart-id')
  if (!guestId || !/^[\w-]{8,64}$/.test(guestId)) {
    throw new ServiceError(422, 'VALIDATION_ERROR', 'Identificador do carrinho de visitante ausente.')
  }
  const id = `guest_${guestId}`
  if (!db.carts[id]) {
    db.carts[id] = { id, userId: null, lines: [], version: 1, updatedAt: new Date().toISOString() }
  }
  return { cart: db.carts[id]!, user: null }
}

/** Clamps lines to current availability; returns the public view of the cart. */
export function viewCart(record: CartRecord): Cart {
  const lines: CartLine[] = []
  for (const input of record.lines) {
    const nft = db.nfts[input.nftId]
    const edition = nft?.editions.find((e) => e.id === input.edition)
    if (!nft || !edition) continue
    const max = Math.min(edition.available, edition.maxPerOrder)
    let quantity = input.quantity
    let adjusted: CartLine['adjusted']
    if (max === 0) adjusted = 'sold-out'
    else if (quantity > max) {
      quantity = max
      adjusted = 'quantity-reduced'
    }
    lines.push({
      lineId: `${nft.id}:${edition.id}`,
      nftId: nft.id,
      edition: edition.id,
      quantity,
      nft: { id: nft.id, tokenId: nft.tokenId, name: nft.name, image: nft.image, imageAlt: nft.imageAlt, network: nft.network, version: nft.version },
      unitPrice: edition.price,
      lineTotal: adjusted === 'sold-out' ? '0' : mulEth(edition.price, quantity),
      available: edition.available,
      maxPerOrder: edition.maxPerOrder,
      adjusted,
    })
  }
  const purchasable = lines.filter((l) => l.adjusted !== 'sold-out')
  return {
    id: record.id,
    owner: record.userId ? 'user' : 'guest',
    lines,
    itemCount: purchasable.reduce((n, l) => n + l.quantity, 0),
    subtotal: sumEth(purchasable.map((l) => l.lineTotal)),
    version: record.version,
    updatedAt: record.updatedAt,
  }
}

export function assertLine(input: CartLineInput, existingQty = 0) {
  const nft = db.nfts[input.nftId]
  if (!nft) throw new ServiceError(404, 'NOT_FOUND', 'NFT não encontrado.')
  const edition = nft.editions.find((e) => e.id === input.edition)
  if (!edition) throw new ServiceError(422, 'VALIDATION_ERROR', 'Edição inválida.', { fields: { edition: 'Edição inválida.' } })
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new ServiceError(422, 'VALIDATION_ERROR', 'Quantidade deve ser um inteiro maior que zero.', { fields: { quantity: 'Quantidade inválida.' } })
  }
  const max = Math.min(edition.available, edition.maxPerOrder)
  if (max === 0) {
    throw new ServiceError(409, 'AVAILABILITY_CONFLICT', `A edição ${edition.id} de ${nft.name} está esgotada.`, { details: { nftId: nft.id, edition: edition.id, available: 0 } })
  }
  if (input.quantity + existingQty > max) {
    throw new ServiceError(409, 'AVAILABILITY_CONFLICT', `Só há ${max} unidade(s) disponível(is) da edição ${edition.id} de ${nft.name}.`, {
      details: { nftId: nft.id, edition: edition.id, available: max },
    })
  }
}

export function touchCart(cart: CartRecord) {
  cart.version += 1
  cart.updatedAt = new Date().toISOString()
  persist()
}

export function mergeCarts(guest: CartRecord, target: CartRecord) {
  for (const line of guest.lines) {
    const existing = target.lines.find((l) => l.nftId === line.nftId && l.edition === line.edition)
    const nft = db.nfts[line.nftId]
    const edition = nft?.editions.find((e) => e.id === line.edition)
    if (!edition) continue
    const max = Math.min(edition.available, edition.maxPerOrder)
    if (existing) existing.quantity = Math.min(max, existing.quantity + line.quantity) || existing.quantity
    else target.lines.push({ ...line, quantity: Math.min(line.quantity, Math.max(max, 1)) })
  }
  delete db.carts[guest.id]
  touchCart(target)
}

/* ───────── quote ───────── */

export function buildQuote(cart: CartRecord, userId: string | null, couponCode: string | undefined, network: Network): QuoteRecord {
  const view = viewCart(cart)
  const purchasable = view.lines.filter((l) => l.adjusted !== 'sold-out')
  if (purchasable.length === 0) throw new ServiceError(422, 'VALIDATION_ERROR', 'Seu carrinho está vazio.')

  let coupon: Quote['coupon'] = null
  if (couponCode) {
    const code = couponCode.trim().toUpperCase()
    const found = COUPONS.find((c) => c.code === code)
    if (!found) throw new ServiceError(422, 'COUPON_INVALID', 'Cupom inválido.', { fields: { couponCode: 'Cupom inválido.' } })
    if (new Date(found.expiresAt).getTime() < Date.now()) {
      throw new ServiceError(422, 'COUPON_EXPIRED', 'Este cupom expirou.', { fields: { couponCode: 'Este cupom expirou.' } })
    }
    coupon = { code: found.code, percentOff: found.percentOff }
  }
  const subtotal = view.subtotal
  const discount = coupon ? percentOf(subtotal, coupon.percentOff) : '0'
  const networkFee = NETWORK_FEES[network]
  const total = sumEth([subEth(subtotal, discount), networkFee])
  const now = Date.now()
  const quote: QuoteRecord = {
    id: nextId('qt'),
    cartId: cart.id,
    userId,
    cartVersion: cart.version,
    lines: purchasable.map((l) => ({
      lineId: l.lineId,
      nftId: l.nftId,
      edition: l.edition,
      name: l.nft.name,
      tokenId: l.nft.tokenId,
      image: l.nft.image,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
      nftVersion: l.nft.version,
    })),
    subtotal,
    coupon,
    discount,
    networkFee,
    network,
    total,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 10 * 60_000).toISOString(),
  }
  db.quotes[quote.id] = quote
  persist()
  return quote
}

/** Re-validates a quote against current catalog/cart state. Throws 409 with a fresh quote on drift. */
export function revalidateQuote(quote: QuoteRecord) {
  const cart = db.carts[quote.cartId]
  if (!cart) throw new ServiceError(409, 'QUOTE_STALE', 'Seu carrinho mudou. Revise o pedido.')
  for (const line of quote.lines) {
    const edition = db.nfts[line.nftId]?.editions.find((e) => e.id === line.edition)
    if (!edition || edition.available < line.quantity) {
      throw new ServiceError(409, 'AVAILABILITY_CONFLICT', `${line.name} (edição ${line.edition}) não tem mais ${line.quantity} unidade(s) disponível(is).`, {
        details: { nftId: line.nftId, edition: line.edition, available: edition?.available ?? 0 },
      })
    }
  }
  const fresh = buildQuote(cart, quote.userId, quote.coupon?.code, quote.network)
  const drift =
    compareEth(fresh.total, quote.total) !== 0 ||
    fresh.lines.length !== quote.lines.length ||
    fresh.lines.some((l, i) => l.unitPrice !== quote.lines[i]?.unitPrice || l.quantity !== quote.lines[i]?.quantity) ||
    Date.parse(quote.expiresAt) < Date.now()
  if (drift) {
    throw new ServiceError(409, 'QUOTE_STALE', 'Preço, disponibilidade ou taxas mudaram. Confirme a nova cotação.', { details: { quote: fresh } })
  }
  delete db.quotes[fresh.id]
}

/* ───────── orders ───────── */

const settleTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function scheduleSettlement(order: OrderRecord) {
  if (order.status !== 'pending' || settleTimers.has(order.id)) return
  const wait = Math.max(0, order.settlesAt - Date.now())
  settleTimers.set(order.id, setTimeout(() => settleOrder(order.id), wait))
}

export function settleOrder(orderId: string) {
  settleTimers.delete(orderId)
  const order = db.orders[orderId]
  if (!order || order.status !== 'pending') return order
  order.status = order.outcome
  order.version += 1
  order.settledAt = new Date().toISOString()
  if (order.status === 'confirmed') {
    order.txHash = `0x${[...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('')}`
    order.explorerUrl = `https://etherscan.io/tx/${order.txHash}`
    // remove only the purchased quantities from the buyer's cart
    const cart = db.carts[db.userCart[order.userId] ?? '']
    if (cart) {
      for (const p of order.purchased) {
        const line = cart.lines.find((l) => l.nftId === p.nftId && l.edition === p.edition)
        if (!line) continue
        line.quantity -= p.quantity
      }
      cart.lines = cart.lines.filter((l) => l.quantity > 0)
      touchCart(cart)
    }
  } else {
    order.declineReason = 'A carteira recusou a assinatura da transação.'
    // release the reserved stock
    for (const p of order.purchased) {
      const nft = db.nfts[p.nftId]
      const edition = nft?.editions.find((e) => e.id === p.edition)
      if (!nft || !edition) continue
      updateNft(nft.id, { edition: edition.id, available: edition.available + p.quantity })
    }
  }
  persist()
  publishOrderUpdated(order)
  return order
}

/** On boot: resume timers for pending orders (or settle immediately if overdue). */
export function resumePendingOrders() {
  for (const order of Object.values(db.orders)) {
    if (order.status === 'pending') scheduleSettlement(order)
  }
}

export function clearSettlementTimers() {
  settleTimers.forEach((t) => clearTimeout(t))
  settleTimers.clear()
}

export function publicOrder(o: OrderRecord) {
  const { userId: _u, requestHash: _r, settlesAt: _s, outcome: _o, purchased: _p, ...order } = o
  return order
}

export async function hashRequest(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
