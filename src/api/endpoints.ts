import type {
  Cart,
  CartLineInput,
  ChangePasswordRequest,
  CreateOrderRequest,
  FavoritesResponse,
  LoginRequest,
  Nft,
  NftListParams,
  NftListResponse,
  Order,
  OrderStatus,
  Quote,
  QuoteRequest,
  RegisterRequest,
  Session,
  UpdateProfileRequest,
  User,
  Wallet,
  WalletConnectRequest,
  WalletConnection,
  WalletInput,
  WalletSlot,
} from '@/contracts/api'
import { http } from './http'

type Opts = { signal?: AbortSignal }

/* auth */
export const authApi = {
  login: (body: LoginRequest) => http.post<Session>('/auth/login', body).then((r) => r.data),
  register: (body: RegisterRequest) => http.post<Session>('/auth/register', body).then((r) => r.data),
  session: (o: Opts = {}) => http.get<{ user: User; expiresAt: string }>('/auth/session', o).then((r) => r.data),
  logout: () => http.post<void>('/auth/logout').then(() => undefined),
}

/* nfts */
function listQuery(p: NftListParams & { ids?: string[] }) {
  return {
    q: p.q || undefined,
    categories: p.categories?.length ? p.categories.join(',') : undefined,
    networks: p.networks?.length ? p.networks.join(',') : undefined,
    minPrice: p.minPrice || undefined,
    maxPrice: p.maxPrice || undefined,
    tab: p.tab,
    sort: p.sort,
    page: p.page,
    pageSize: p.pageSize,
    ids: p.ids?.length ? p.ids.join(',') : undefined,
  }
}

export const nftApi = {
  list: (params: NftListParams & { ids?: string[] }, o: Opts = {}) =>
    http.get<NftListResponse>('/nfts', { params: listQuery(params), signal: o.signal }).then((r) => r.data),
  detail: (id: string, o: Opts = {}) => http.get<Nft>(`/nfts/${encodeURIComponent(id)}`, o).then((r) => r.data),
}

/* favorites */
export const favoritesApi = {
  list: (o: Opts = {}) => http.get<FavoritesResponse>('/me/favorites', o).then((r) => r.data),
  add: (nftId: string) => http.put<FavoritesResponse>(`/me/favorites/${encodeURIComponent(nftId)}`).then((r) => r.data),
  remove: (nftId: string) => http.delete<FavoritesResponse>(`/me/favorites/${encodeURIComponent(nftId)}`).then((r) => r.data),
}

/* cart */
export const cartApi = {
  get: (o: Opts = {}) => http.get<Cart>('/cart', o).then((r) => r.data),
  add: (line: CartLineInput) => http.post<Cart>('/cart/items', line).then((r) => r.data),
  update: (lineId: string, quantity: number) => http.patch<Cart>(`/cart/items/${encodeURIComponent(lineId)}`, { quantity }).then((r) => r.data),
  remove: (lineId: string) => http.delete<Cart>(`/cart/items/${encodeURIComponent(lineId)}`).then((r) => r.data),
  merge: (guestCartId: string) => http.post<Cart>('/cart/merge', { guestCartId }).then((r) => r.data),
  quote: (body: QuoteRequest, o: Opts = {}) => http.post<Quote>('/cart/quote', body, o).then((r) => r.data),
}

/* wallets */
export const walletApi = {
  list: (o: Opts = {}) => http.get<{ items: Wallet[] }>('/me/wallets', o).then((r) => r.data.items),
  create: (slot: WalletSlot, body: WalletInput) => http.post<Wallet>('/me/wallets', { ...body, slot }).then((r) => r.data),
  update: (id: string, body: WalletInput) => http.put<Wallet>(`/me/wallets/${id}`, body).then((r) => r.data),
  connect: (body: WalletConnectRequest) => http.post<WalletConnection>('/wallets/connect', body).then((r) => r.data),
  disconnect: (connectionId: string) => http.delete<void>(`/wallets/connections/${connectionId}`).then(() => undefined),
}

/* orders */
export const orderApi = {
  /** Order creation has a shorter timeout: on timeout the client re-sends with the same key. */
  create: (body: CreateOrderRequest, idempotencyKey: string) =>
    http
      .post<Order>('/orders', body, { headers: { 'Idempotency-Key': idempotencyKey }, timeout: 6_000 })
      .then((r) => r.data),
  get: (id: string, o: Opts = {}) => http.get<Order>(`/orders/${encodeURIComponent(id)}`, o).then((r) => r.data),
  list: (status?: OrderStatus, o: Opts = {}) =>
    http.get<{ items: Order[] }>('/orders', { params: { status }, signal: o.signal }).then((r) => r.data.items),
}

/* profile */
export const profileApi = {
  get: (o: Opts = {}) => http.get<User>('/me/profile', o).then((r) => r.data),
  update: (body: UpdateProfileRequest) => http.put<User>('/me/profile', body).then((r) => r.data),
  setAvatar: (dataUrl: string) => http.put<User>('/me/avatar', { dataUrl }).then((r) => r.data),
  removeAvatar: () => http.delete<User>('/me/avatar').then((r) => r.data),
  changePassword: (body: ChangePasswordRequest) => http.post<void>('/me/password', body).then(() => undefined),
}
