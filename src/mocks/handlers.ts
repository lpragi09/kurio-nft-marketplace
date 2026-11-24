import { delay, http, HttpResponse, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type {
  ApiErrorBody,
  CatalogSort,
  CatalogTab,
  CollectionCategory,
  CreateOrderRequest,
  EditionId,
  Network,
  NftListResponse,
  Wallet,
  WalletConnection,
} from '@/contracts/api'
import { EDITION_IDS, NETWORKS } from '@/contracts/api'
import {
  buyerSchema,
  changePasswordSchema,
  loginSchema,
  profileSchema,
  registerSchema,
  walletSchema,
  zodFields,
} from '@/contracts/schemas'
import { compareEth, eth } from '@/lib/eth'
import {
  bumpFailureCounter,
  consumeOnce,
  db,
  nextId,
  nextRequestIndex,
  persist,
  resetDb,
  scenario,
  setScenario,
  type OrderRecord,
} from './db'
import { CATEGORY_NAMES, mulberry32 } from './fixtures'
import { dropAllSockets, liveSocketCount } from './realtime'
import { buildScenario, isScenarioName, SCENARIOS, type RouteKey } from './scenarios'
import {
  assertLine,
  buildQuote,
  cartKey,
  clearSettlementTimers,
  createSession,
  hashPassword,
  hashRequest,
  mergeCarts,
  publicOrder,
  publicUser,
  requireUser,
  revalidateQuote,
  scheduleSettlement,
  ServiceError,
  settleOrder,
  toSummary,
  touchCart,
  updateNft,
  viewCart,
} from './service'

const API = '/api'

function errorResponse(status: number, code: string, message: string, extra: { fields?: Record<string, string>; details?: unknown } = {}) {
  const body: ApiErrorBody = { error: { code: code as ApiErrorBody['error']['code'], message, ...extra } }
  return HttpResponse.json(body, { status })
}

const DEFAULT_MESSAGES: Record<number, string> = {
  401: 'Sua sessão expirou. Entre novamente.',
  403: 'Você não tem permissão para acessar este recurso.',
  500: 'Erro interno no servidor. Tente novamente em instantes.',
  503: 'Serviço temporariamente indisponível. Tente novamente.',
}

async function applyLatency() {
  const l = scenario.latency
  const n = nextRequestIndex()
  if (l.mode === 'fixed') return delay(l.ms)
  if (l.mode === 'variable') {
    const r = mulberry32(l.seed + n)()
    return delay(Math.round(l.minMs + r * (l.maxMs - l.minMs)))
  }
  return delay(n % 2 === 1 ? l.slowMs : l.fastMs)
}

/** Wraps a resolver with scenario effects: offline, latency, injected failures and error mapping. */
function route<P extends PathParams, B extends DefaultBodyType>(
  key: RouteKey | null,
  resolver: HttpResponseResolver<P, B>,
): HttpResponseResolver<P, B> {
  return async (info) => {
    if (scenario.offline) return HttpResponse.error()
    await applyLatency()
    if (key) {
      const rule = scenario.failures[key]
      if (rule) {
        const count = bumpFailureCounter(key)
        if (rule.times === undefined || count <= rule.times) {
          return errorResponse(rule.status, rule.code, DEFAULT_MESSAGES[rule.status] ?? 'Falha simulada.')
        }
      }
    }
    try {
      return await resolver(info)
    } catch (e) {
      if (e instanceof ServiceError) return errorResponse(e.status, e.code, e.message, { fields: e.fields, details: e.details })
      console.error('[mock] unhandled error', e)
      return errorResponse(500, 'INTERNAL', 'Erro interno no servidor.')
    }
  }
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new ServiceError(400, 'VALIDATION_ERROR', 'Corpo da requisição inválido.')
  }
}

function parseList<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return []
  return raw.split(',').filter((v): v is T => (allowed as readonly string[]).includes(v))
}

/* ─────────────────────────── handlers ─────────────────────────── */

export const restHandlers = [
  /* ───── auth ───── */
  http.post(`${API}/auth/register`, route('auth', async ({ request }) => {
    const parsed = registerSchema.safeParse(await readJson(request))
    if (!parsed.success) throw new ServiceError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', { fields: zodFields(parsed.error) })
    const { username, email, password } = parsed.data
    const users = Object.values(db.users)
    const fields: Record<string, string> = {}
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) fields.email = 'Este e-mail já está cadastrado.'
    if (users.some((u) => u.username === username)) fields.username = 'Este nome de usuário já está em uso.'
    if (Object.keys(fields).length) throw new ServiceError(409, 'CONFLICT', 'Já existe uma conta com esses dados.', { fields })
    const id = nextId('u')
    const salt = crypto.randomUUID()
    db.users[id] = {
      id,
      username,
      email,
      displayName: username,
      ensName: username.replace(/[._]/g, '-'),
      walletNickname: 'Principal',
      avatarUrl: null,
      passwordSalt: salt,
      passwordHash: await hashPassword(salt, password),
    }
    db.favorites[id] = []
    db.wallets[id] = []
    persist()
    return HttpResponse.json(createSession(id), { status: 201 })
  })),

  http.post(`${API}/auth/login`, route('auth', async ({ request }) => {
    const parsed = loginSchema.safeParse(await readJson(request))
    if (!parsed.success) throw new ServiceError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', { fields: zodFields(parsed.error) })
    const user = Object.values(db.users).find((u) => u.email.toLowerCase() === parsed.data.email.toLowerCase())
    if (!user || (await hashPassword(user.passwordSalt, parsed.data.password)) !== user.passwordHash) {
      throw new ServiceError(401, 'UNAUTHENTICATED', 'E-mail ou senha incorretos.', { fields: { password: 'E-mail ou senha incorretos.' } })
    }
    return HttpResponse.json(createSession(user.id))
  })),

  http.get(`${API}/auth/session`, route('auth', ({ request }) => {
    const user = requireUser(request)
    const token = request.headers.get('authorization')!.slice(7)
    return HttpResponse.json({ user: publicUser(user), expiresAt: new Date(db.sessions[token]!.expiresAt).toISOString() })
  })),

  http.post(`${API}/auth/logout`, route(null, ({ request }) => {
    const token = request.headers.get('authorization')?.slice(7)
    const userId = token ? db.sessions[token]?.userId : undefined
    if (token) {
      delete db.sessions[token]
      for (const [id, c] of Object.entries(db.connections)) if (c.userId === userId) delete db.connections[id]
      persist()
    }
    return new HttpResponse(null, { status: 204 })
  })),

  /* ───── nfts ───── */
  http.get(`${API}/nfts`, route('nfts:list', ({ request }) => {
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const categories = parseList(url.searchParams.get('categories'), Object.keys(CATEGORY_NAMES) as CollectionCategory[])
    const networks = parseList(url.searchParams.get('networks'), NETWORKS)
    const minPrice = url.searchParams.get('minPrice')
    const maxPrice = url.searchParams.get('maxPrice')
    const tab = (url.searchParams.get('tab') ?? 'todos') as CatalogTab
    const sort = (url.searchParams.get('sort') ?? 'recentes') as CatalogSort
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
    const pageSize = Math.min(48, Math.max(1, Number(url.searchParams.get('pageSize') ?? 9) || 9))

    let all = db.nftOrder.map((id) => db.nfts[id]!)
    if (scenario.emptyCatalog) all = []
    const ids = url.searchParams.get('ids')
    if (ids) {
      const wanted = new Set(ids.split(','))
      all = all.filter((n) => wanted.has(n.id))
    }
    const now = Date.parse('2026-10-01T12:00:00.000Z')
    if (tab === 'novos') all = all.filter((n) => now - Date.parse(n.listedAt) <= 7 * 24 * 36e5 * 2)
    if (tab === 'em-alta') all = all.filter((n) => n.trendingScore >= 60)
    if (q) all = all.filter((n) => `${n.name} ${n.tokenId} ${n.collectionName}`.toLowerCase().includes(q))

    // Facets are computed before applying the facet's own filter (standard faceting)
    const byPrice = all.filter(
      (n) => (!minPrice || compareEth(n.price, minPrice) >= 0) && (!maxPrice || compareEth(n.price, maxPrice) <= 0),
    )
    const categoryCounts = Object.fromEntries(Object.keys(CATEGORY_NAMES).map((c) => [c, 0])) as Record<CollectionCategory, number>
    byPrice.filter((n) => !networks.length || networks.includes(n.network)).forEach((n) => categoryCounts[n.category]++)
    const networkCounts = { ethereum: 0, polygon: 0, solana: 0 } as Record<Network, number>
    byPrice.filter((n) => !categories.length || categories.includes(n.category)).forEach((n) => networkCounts[n.network]++)

    let filtered = byPrice.filter((n) => (!categories.length || categories.includes(n.category)) && (!networks.length || networks.includes(n.network)))
    filtered = [...filtered].sort((a, b) => {
      switch (sort) {
        case 'preco-asc': return compareEth(a.price, b.price) || a.name.localeCompare(b.name)
        case 'preco-desc': return compareEth(b.price, a.price) || a.name.localeCompare(b.name)
        case 'nome': return a.name.localeCompare(b.name, 'pt-BR')
        default: return tab === 'em-alta' ? b.trendingScore - a.trendingScore : Date.parse(b.listedAt) - Date.parse(a.listedAt)
      }
    })
    const prices = db.nftOrder.map((id) => db.nfts[id]!.price)
    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const body: NftListResponse = {
      items: filtered.slice((page - 1) * pageSize, page * pageSize).map(toSummary),
      page,
      pageSize,
      total,
      totalPages,
      facets: {
        categories: categoryCounts,
        networks: networkCounts,
        priceRange: {
          min: prices.reduce((m, p) => (compareEth(p, m) < 0 ? p : m), prices[0] ?? '0'),
          max: prices.reduce((m, p) => (compareEth(p, m) > 0 ? p : m), prices[0] ?? '0'),
        },
      },
    }
    return HttpResponse.json(body)
  })),

  http.get(`${API}/nfts/:id`, route('nfts:detail', ({ params }) => {
    const nft = db.nfts[String(params.id)]
    if (!nft || scenario.emptyCatalog) throw new ServiceError(404, 'NOT_FOUND', 'Este NFT não existe ou foi removido.')
    return HttpResponse.json(nft)
  })),

  /* ───── favorites ───── */
  http.get(`${API}/me/favorites`, route('favorites:read', ({ request }) => {
    const user = requireUser(request)
    return HttpResponse.json({ nftIds: db.favorites[user.id] ?? [] })
  })),
  http.put(`${API}/me/favorites/:nftId`, route('favorites:write', ({ request, params }) => {
    const user = requireUser(request)
    const id = String(params.nftId)
    if (!db.nfts[id]) throw new ServiceError(404, 'NOT_FOUND', 'NFT não encontrado.')
    const list = (db.favorites[user.id] ??= [])
    if (!list.includes(id)) list.push(id)
    persist()
    return HttpResponse.json({ nftIds: list })
  })),
  http.delete(`${API}/me/favorites/:nftId`, route('favorites:write', ({ request, params }) => {
    const user = requireUser(request)
    db.favorites[user.id] = (db.favorites[user.id] ?? []).filter((id) => id !== String(params.nftId))
    persist()
    return HttpResponse.json({ nftIds: db.favorites[user.id] })
  })),

  /* ───── cart ───── */
  http.get(`${API}/cart`, route('cart:read', ({ request }) => HttpResponse.json(viewCart(cartKey(request).cart)))),

  http.post(`${API}/cart/items`, route('cart:write', async ({ request }) => {
    const { cart } = cartKey(request)
    const input = await readJson<{ nftId: string; edition: EditionId; quantity: number }>(request)
    if (!EDITION_IDS.includes(input.edition)) throw new ServiceError(422, 'VALIDATION_ERROR', 'Edição inválida.')
    const existing = cart.lines.find((l) => l.nftId === input.nftId && l.edition === input.edition)
    assertLine(input, existing?.quantity ?? 0)
    if (existing) existing.quantity += input.quantity
    else cart.lines.push({ nftId: input.nftId, edition: input.edition, quantity: input.quantity })
    touchCart(cart)
    return HttpResponse.json(viewCart(cart), { status: 201 })
  })),

  http.patch(`${API}/cart/items/:lineId`, route('cart:write', async ({ request, params }) => {
    const { cart } = cartKey(request)
    const [nftId, edition] = String(params.lineId).split(':') as [string, EditionId]
    const line = cart.lines.find((l) => l.nftId === nftId && l.edition === edition)
    if (!line) throw new ServiceError(404, 'NOT_FOUND', 'Item não está no carrinho.')
    const { quantity } = await readJson<{ quantity: number }>(request)
    assertLine({ nftId, edition, quantity })
    line.quantity = quantity
    touchCart(cart)
    return HttpResponse.json(viewCart(cart))
  })),

  http.delete(`${API}/cart/items/:lineId`, route('cart:write', ({ request, params }) => {
    const { cart } = cartKey(request)
    const [nftId, edition] = String(params.lineId).split(':')
    cart.lines = cart.lines.filter((l) => !(l.nftId === nftId && l.edition === edition))
    touchCart(cart)
    return HttpResponse.json(viewCart(cart))
  })),

  http.post(`${API}/cart/merge`, route('cart:write', async ({ request }) => {
    const user = requireUser(request)
    const { cart } = cartKey(request)
    const { guestCartId } = await readJson<{ guestCartId: string }>(request)
    const guest = db.carts[`guest_${guestCartId}`]
    if (guest && guest.lines.length) mergeCarts(guest, cart)
    void user
    return HttpResponse.json(viewCart(cart))
  })),

  /* ───── quote ───── */
  http.post(`${API}/cart/quote`, route('quote', async ({ request }) => {
    const { cart, user } = cartKey(request)
    const body = await readJson<{ couponCode?: string; network?: Network }>(request)
    const network = body.network && NETWORKS.includes(body.network) ? body.network : 'ethereum'
    const { cartId: _c, userId: _u, ...quote } = buildQuote(cart, user?.id ?? null, body.couponCode || undefined, network)
    return HttpResponse.json(quote)
  })),

  /* ───── wallet connection (simulated) ───── */
  http.post(`${API}/wallets/connect`, route('wallets', async ({ request }) => {
    const user = requireUser(request)
    const body = await readJson<{ provider: Wallet['provider']; network: Network; walletId: string }>(request)
    const wallet = (db.wallets[user.id] ?? []).find((w) => w.id === body.walletId)
    if (!wallet) throw new ServiceError(404, 'NOT_FOUND', 'Carteira não encontrada.')
    await delay(600)
    if (scenario.wallet.rejectConnection) {
      throw new ServiceError(409, 'WALLET_REJECTED', 'A carteira recusou a solicitação de conexão.')
    }
    const connection: WalletConnection & { userId: string } = {
      connectionId: nextId('conn'),
      walletId: wallet.id,
      provider: body.provider,
      network: body.network,
      address: wallet.address,
      connectedAt: new Date().toISOString(),
      userId: user.id,
    }
    db.connections[connection.connectionId] = connection
    persist()
    const { userId: _u, ...pub } = connection
    return HttpResponse.json(pub, { status: 201 })
  })),

  http.delete(`${API}/wallets/connections/:id`, route('wallets', ({ request, params }) => {
    const user = requireUser(request)
    const conn = db.connections[String(params.id)]
    if (conn && conn.userId === user.id) delete db.connections[String(params.id)]
    persist()
    return new HttpResponse(null, { status: 204 })
  })),

  /* ───── orders ───── */
  http.post(`${API}/orders`, route('orders:create', async ({ request }) => {
    const user = requireUser(request)
    const key = request.headers.get('idempotency-key')
    if (!key || key.length < 8) throw new ServiceError(422, 'VALIDATION_ERROR', 'Cabeçalho Idempotency-Key é obrigatório.')
    const body = await readJson<CreateOrderRequest>(request)
    const requestHash = await hashRequest({ q: body.quoteId, t: body.expectedTotal, w: body.walletId, n: body.network, c: body.connectionId })
    const idemKey = `${user.id}:${key}`

    // Idempotent replay: same key + same payload → same order
    const prior = db.idempotency[idemKey]
    if (prior) {
      if (prior.requestHash !== requestHash) {
        throw new ServiceError(409, 'IDEMPOTENCY_CONFLICT', 'Esta tentativa de compra já foi usada com outros dados.')
      }
      return HttpResponse.json(publicOrder(db.orders[prior.orderId]!), { status: 200, headers: { 'Idempotent-Replayed': 'true' } })
    }

    const buyer = buyerSchema.safeParse(body.buyer)
    if (!buyer.success) throw new ServiceError(422, 'VALIDATION_ERROR', 'Verifique os dados do colecionador.', { fields: zodFields(buyer.error) })
    const quote = db.quotes[body.quoteId]
    if (!quote || quote.userId !== user.id) throw new ServiceError(409, 'QUOTE_STALE', 'Cotação expirada. Revise o pedido novamente.')
    const connection = db.connections[body.connectionId]
    if (!connection || connection.userId !== user.id) {
      throw new ServiceError(409, 'WALLET_REJECTED', 'A carteira foi desconectada. Conecte-a novamente.')
    }

    // Scenario hooks that mutate the catalog *during* checkout
    const first = quote.lines[0]
    if (first && scenario.order.priceChangeOnCheckout && consumeOnce('priceChangeOnCheckout')) {
      updateNft(first.nftId, { edition: first.edition, editionPrice: eth(first.unitPrice).plus('0.05').toString() })
    }
    if (first && scenario.order.soldOutOnCheckout && consumeOnce('soldOutOnCheckout')) {
      updateNft(first.nftId, { edition: first.edition, available: 0 })
    }

    revalidateQuote(quote)
    if (compareEth(quote.total, body.expectedTotal) !== 0) {
      throw new ServiceError(409, 'QUOTE_STALE', 'O total exibido não corresponde à cotação.')
    }

    const wallet = (db.wallets[user.id] ?? []).find((w) => w.id === body.walletId)
    const order: OrderRecord = {
      id: nextId('ord'),
      status: 'pending',
      version: 1,
      idempotencyKey: key,
      lines: quote.lines.map((l) => ({
        nftId: l.nftId,
        edition: l.edition,
        name: l.name,
        tokenId: l.tokenId,
        image: l.image,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      })),
      subtotal: quote.subtotal,
      discount: quote.discount,
      coupon: quote.coupon?.code ?? null,
      networkFee: quote.networkFee,
      total: quote.total,
      network: body.network,
      walletProvider: connection.provider,
      walletAddress: wallet?.address ?? connection.address,
      txHash: null,
      explorerUrl: null,
      declineReason: null,
      createdAt: new Date().toISOString(),
      settledAt: null,
      userId: user.id,
      requestHash,
      settlesAt: Date.now() + scenario.order.settleMs,
      outcome: scenario.order.outcome,
      purchased: quote.lines.map((l) => ({ nftId: l.nftId, edition: l.edition, quantity: l.quantity })),
    }
    db.orders[order.id] = order
    db.idempotency[idemKey] = { orderId: order.id, requestHash }
    delete db.quotes[quote.id]
    persist()
    // reserve stock (emits nft.updated)
    for (const l of order.purchased) {
      const edition = db.nfts[l.nftId]!.editions.find((e) => e.id === l.edition)!
      updateNft(l.nftId, { edition: l.edition, available: edition.available - l.quantity })
    }
    scheduleSettlement(order)

    if (scenario.order.timeoutAfterCreate && consumeOnce('timeoutAfterCreate')) {
      await delay('infinite') // committed, but the response never arrives
    }
    return HttpResponse.json(publicOrder(order), { status: 201 })
  })),

  http.get(`${API}/orders`, route('orders:read', ({ request }) => {
    const user = requireUser(request)
    const status = new URL(request.url).searchParams.get('status')
    const list = Object.values(db.orders)
      .filter((o) => o.userId === user.id && (!status || o.status === status))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map(publicOrder)
    return HttpResponse.json({ items: list })
  })),

  http.get(`${API}/orders/:id`, route('orders:read', ({ request, params }) => {
    const user = requireUser(request)
    const order = db.orders[String(params.id)]
    if (!order) throw new ServiceError(404, 'NOT_FOUND', 'Pedido não encontrado.')
    if (order.userId !== user.id) throw new ServiceError(403, 'FORBIDDEN', 'Este pedido pertence a outra conta.')
    // Lazy settlement in case the timer was lost (e.g. tab was closed)
    if (order.status === 'pending' && order.settlesAt <= Date.now()) settleOrder(order.id)
    return HttpResponse.json(publicOrder(db.orders[order.id]!))
  })),

  /* ───── profile ───── */
  http.get(`${API}/me/profile`, route('profile', ({ request }) => HttpResponse.json(publicUser(requireUser(request))))),

  http.put(`${API}/me/profile`, route('profile', async ({ request }) => {
    const user = requireUser(request)
    const parsed = profileSchema.safeParse(await readJson(request))
    if (!parsed.success) throw new ServiceError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', { fields: zodFields(parsed.error) })
    const others = Object.values(db.users).filter((u) => u.id !== user.id)
    const fields: Record<string, string> = {}
    if (others.some((u) => u.email.toLowerCase() === parsed.data.email.toLowerCase())) fields.email = 'Este e-mail já está em uso por outra conta.'
    if (others.some((u) => u.username === parsed.data.username)) fields.username = 'Este nome de usuário já está em uso.'
    if (Object.keys(fields).length) throw new ServiceError(409, 'CONFLICT', 'Alguns dados já estão em uso.', { fields })
    Object.assign(user, parsed.data)
    persist()
    return HttpResponse.json(publicUser(user))
  })),

  http.put(`${API}/me/avatar`, route('profile', async ({ request }) => {
    const user = requireUser(request)
    const { dataUrl } = await readJson<{ dataUrl: string }>(request)
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)) {
      throw new ServiceError(422, 'VALIDATION_ERROR', 'Envie uma imagem PNG, JPG ou WebP.', { fields: { avatar: 'Formato não suportado.' } })
    }
    if (dataUrl.length > 700_000) throw new ServiceError(422, 'VALIDATION_ERROR', 'Imagem muito grande (máx. 512 KB).', { fields: { avatar: 'Imagem muito grande.' } })
    user.avatarUrl = dataUrl
    persist()
    return HttpResponse.json(publicUser(user))
  })),

  http.delete(`${API}/me/avatar`, route('profile', ({ request }) => {
    const user = requireUser(request)
    user.avatarUrl = null
    persist()
    return HttpResponse.json(publicUser(user))
  })),

  http.post(`${API}/me/password`, route('profile', async ({ request }) => {
    const user = requireUser(request)
    const parsed = changePasswordSchema.safeParse(await readJson(request))
    if (!parsed.success) throw new ServiceError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', { fields: zodFields(parsed.error) })
    if ((await hashPassword(user.passwordSalt, parsed.data.currentPassword)) !== user.passwordHash) {
      throw new ServiceError(422, 'VALIDATION_ERROR', 'Senha atual incorreta.', { fields: { currentPassword: 'Senha atual incorreta.' } })
    }
    user.passwordSalt = crypto.randomUUID()
    user.passwordHash = await hashPassword(user.passwordSalt, parsed.data.newPassword)
    persist()
    return new HttpResponse(null, { status: 204 })
  })),

  /* ───── wallets ───── */
  http.get(`${API}/me/wallets`, route('wallets', ({ request }) => {
    const user = requireUser(request)
    return HttpResponse.json({ items: db.wallets[user.id] ?? [] })
  })),

  http.post(`${API}/me/wallets`, route('wallets', async ({ request }) => {
    const user = requireUser(request)
    const body = await readJson<Record<string, unknown> & { slot?: string }>(request)
    const slot = body.slot === 'secondary' ? 'secondary' : 'primary'
    const parsed = walletSchema.safeParse(body)
    if (!parsed.success) throw new ServiceError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', { fields: zodFields(parsed.error) })
    const list = (db.wallets[user.id] ??= [])
    if (list.some((w) => w.slot === slot)) throw new ServiceError(409, 'CONFLICT', 'Já existe uma carteira nesse espaço. Edite-a.')
    if (slot === 'secondary' && !list.some((w) => w.slot === 'primary')) {
      throw new ServiceError(422, 'VALIDATION_ERROR', 'Cadastre a carteira principal antes da secundária.')
    }
    if (list.some((w) => w.address.toLowerCase() === parsed.data.address.toLowerCase())) {
      throw new ServiceError(409, 'CONFLICT', 'Este endereço já está cadastrado.', { fields: { address: 'Este endereço já está cadastrado.' } })
    }
    const wallet: Wallet = { ...parsed.data, secondaryAddress: parsed.data.secondaryAddress || null, id: nextId('w'), slot, updatedAt: new Date().toISOString() }
    list.push(wallet)
    persist()
    return HttpResponse.json(wallet, { status: 201 })
  })),

  http.put(`${API}/me/wallets/:id`, route('wallets', async ({ request, params }) => {
    const user = requireUser(request)
    const list = db.wallets[user.id] ?? []
    const wallet = list.find((w) => w.id === String(params.id))
    if (!wallet) throw new ServiceError(404, 'NOT_FOUND', 'Carteira não encontrada.')
    const parsed = walletSchema.safeParse(await readJson(request))
    if (!parsed.success) throw new ServiceError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', { fields: zodFields(parsed.error) })
    if (list.some((w) => w.id !== wallet.id && w.address.toLowerCase() === parsed.data.address.toLowerCase())) {
      throw new ServiceError(409, 'CONFLICT', 'Este endereço já está cadastrado na outra carteira.', { fields: { address: 'Endereço já usado na outra carteira.' } })
    }
    Object.assign(wallet, parsed.data, { secondaryAddress: parsed.data.secondaryAddress || null, updatedAt: new Date().toISOString() })
    persist()
    return HttpResponse.json(wallet)
  })),

  /* ───── unknown API route ───── */
  http.all(`${API}/*`, route(null, () => {
    throw new ServiceError(404, 'NOT_FOUND', 'Rota da API inexistente.')
  })),
]

/* ─────────────────────────── mock control (dev panel / Playwright) ─────────────────────────── */

export const controlHandlers = [
  http.get('/__mock/state', () =>
    HttpResponse.json({
      scenario,
      scenarios: Object.entries(SCENARIOS).map(([name, s]) => ({ name, label: s.label, description: s.description })),
      sockets: liveSocketCount(),
      orders: Object.values(db.orders).map((o) => ({ id: o.id, status: o.status, userId: o.userId, total: o.total })),
    }),
  ),
  http.post('/__mock/reset', () => {
    clearSettlementTimers()
    resetDb()
    dropAllSockets()
    return HttpResponse.json({ ok: true })
  }),
  http.post('/__mock/scenario', async ({ request }) => {
    const { name } = (await request.json()) as { name: string }
    if (!isScenarioName(name)) return errorResponse(422, 'VALIDATION_ERROR', 'Cenário desconhecido.')
    setScenario(buildScenario(name))
    if (scenario.offline) dropAllSockets()
    return HttpResponse.json({ scenario })
  }),
  http.post('/__mock/nfts/:id', async ({ params, request }) => {
    const patch = (await request.json()) as { price?: string; edition?: EditionId; available?: number; editionPrice?: string }
    try {
      return HttpResponse.json(updateNft(String(params.id), patch))
    } catch (e) {
      if (e instanceof ServiceError) return errorResponse(e.status, e.code, e.message)
      throw e
    }
  }),
  http.post('/__mock/sockets/drop', () => {
    dropAllSockets()
    return HttpResponse.json({ ok: true })
  }),
  http.post('/__mock/sessions/expire', () => {
    for (const s of Object.values(db.sessions)) s.expiresAt = Date.now() - 1
    persist()
    return HttpResponse.json({ ok: true })
  }),
  http.post('/__mock/orders/:id/settle', ({ params }) => {
    const order = db.orders[String(params.id)]
    if (order) order.settlesAt = Date.now()
    return HttpResponse.json(order ? publicOrder(settleOrder(String(params.id))!) : null)
  }),
]
