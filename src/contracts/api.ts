/**
 * REST contracts shared by the MSW mock server and the client.
 * ETH amounts always travel as decimal strings ("1.19"); quantities are integers.
 */

export type EthAmount = string
export type ISODateTime = string

/* ───────────────────────── Errors ───────────────────────── */

export type ApiErrorCode =
  | 'VALIDATION_ERROR' // 422
  | 'UNAUTHENTICATED' // 401 – no/invalid credentials
  | 'SESSION_EXPIRED' // 401 – token expired
  | 'FORBIDDEN' // 403
  | 'NOT_FOUND' // 404
  | 'CONFLICT' // 409 – generic conflict (e.g. e-mail taken)
  | 'AVAILABILITY_CONFLICT' // 409 – stock/edition not available
  | 'QUOTE_STALE' // 409 – price/fee/coupon changed since the quote
  | 'IDEMPOTENCY_CONFLICT' // 409 – same key, different payload
  | 'COUPON_INVALID' // 422
  | 'COUPON_EXPIRED' // 422
  | 'WALLET_REJECTED' // 409 – simulated wallet refused the connection
  | 'TRANSIENT' // 503 – retry later
  | 'INTERNAL' // 500

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    /** field → message, for VALIDATION_ERROR / CONFLICT */
    fields?: Record<string, string>
    /** extra machine-readable details (e.g. the fresh quote on QUOTE_STALE) */
    details?: unknown
  }
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/* ───────────────────────── NFTs ───────────────────────── */

export type Network = 'ethereum' | 'polygon' | 'solana'
export const NETWORKS: Network[] = ['ethereum', 'polygon', 'solana']

export type CollectionCategory =
  | 'arte-digital'
  | 'fotografia'
  | 'musica'
  | 'arte-3d'
  | 'colecionaveis'
  | 'generativa'
  | 'jogos'
  | 'assinaturas'
  | 'utilidade'

export type EditionId = '1/1' | '1/10' | '1/50' | 'aberta'
export const EDITION_IDS: EditionId[] = ['1/1', '1/10', '1/50', 'aberta']

export interface NftEdition {
  id: EditionId
  price: EthAmount
  /** units still available for purchase */
  available: number
  /** max units a single order may contain for this edition */
  maxPerOrder: number
}

export interface NftSummary {
  id: string // slug e.g. "emerald-ape-042"
  tokenId: string // "#0042"
  name: string
  image: string // base path, e.g. /nfts/emerald-ape  (client adds -400.webp)
  imageAlt: string
  category: CollectionCategory
  network: Network
  /** price of the cheapest available edition (display) */
  price: EthAmount
  /** previous price when on sale */
  compareAtPrice?: EthAmount
  rarity?: 'raro' | 'lendario'
  listedAt: ISODateTime
  trendingScore: number
  soldOut: boolean
  /** monotonically increasing; bumped on any price/availability change */
  version: number
}

export interface Nft extends NftSummary {
  description: string
  longDescription: string[]
  collectionName: string
  attributes: string[]
  rating: number
  reviewCount: number
  contractAddress: string
  royaltyPercent: number
  gallery: string[]
  editions: NftEdition[]
}

export type CatalogTab = 'todos' | 'novos' | 'em-alta'
export type CatalogSort = 'recentes' | 'preco-asc' | 'preco-desc' | 'nome'

export interface NftListParams {
  q?: string
  categories?: CollectionCategory[]
  networks?: Network[]
  minPrice?: string
  maxPrice?: string
  tab?: CatalogTab
  sort?: CatalogSort
  page?: number
  pageSize?: number
}

export interface NftListResponse extends Paginated<NftSummary> {
  facets: {
    categories: Record<CollectionCategory, number>
    networks: Record<Network, number>
    priceRange: { min: EthAmount; max: EthAmount }
  }
}

/* ───────────────────────── Auth / account ───────────────────────── */

export interface User {
  id: string
  username: string
  email: string
  displayName: string
  ensName: string // without the ".eth" suffix
  walletNickname: string
  avatarUrl: string | null
}

export interface Session {
  token: string
  expiresAt: ISODateTime
  user: User
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface UpdateProfileRequest {
  displayName: string
  username: string
  email: string
  ensName: string
  walletNickname: string
}

export interface UpdateAvatarRequest {
  /** data: URL of an image ≤ 512 KB (the client resizes before upload) */
  dataUrl: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

/* ───────────────────────── Favorites ───────────────────────── */

export interface FavoritesResponse {
  nftIds: string[]
}

/* ───────────────────────── Cart ───────────────────────── */

export interface CartLineInput {
  nftId: string
  edition: EditionId
  quantity: number
}

export interface CartLine extends CartLineInput {
  lineId: string // `${nftId}:${edition}`
  nft: Pick<NftSummary, 'id' | 'tokenId' | 'name' | 'image' | 'imageAlt' | 'network' | 'version'>
  unitPrice: EthAmount
  lineTotal: EthAmount
  available: number
  maxPerOrder: number
  /** set by the server when the line was clamped because stock dropped */
  adjusted?: 'quantity-reduced' | 'sold-out'
}

export interface Cart {
  id: string
  owner: 'guest' | 'user'
  lines: CartLine[]
  itemCount: number
  subtotal: EthAmount
  version: number
  updatedAt: ISODateTime
}

export interface MergeCartRequest {
  guestCartId: string
}

/* ───────────────────────── Quote ───────────────────────── */

export interface QuoteRequest {
  couponCode?: string
  network?: Network
}

export interface QuoteLine {
  lineId: string
  nftId: string
  edition: EditionId
  name: string
  tokenId: string
  image: string
  quantity: number
  unitPrice: EthAmount
  lineTotal: EthAmount
  nftVersion: number
}

export interface Quote {
  id: string
  cartVersion: number
  lines: QuoteLine[]
  subtotal: EthAmount
  coupon: { code: string; percentOff: number } | null
  discount: EthAmount
  networkFee: EthAmount
  network: Network
  total: EthAmount
  createdAt: ISODateTime
  expiresAt: ISODateTime
}

/* ───────────────────────── Wallets ───────────────────────── */

export type WalletProvider = 'metamask' | 'walletconnect' | 'coinbase'
export type WalletSlot = 'primary' | 'secondary'

export interface Wallet {
  id: string
  slot: WalletSlot
  displayName: string
  nickname: string
  profileName: string
  network: Network
  address: string // 0x… (40 hex)
  secondaryAddress: string | null // ENS or another address
  provider: WalletProvider
  referralCode: string
  email: string
  ensName: string
  updatedAt: ISODateTime
}

export type WalletInput = Omit<Wallet, 'id' | 'slot' | 'updatedAt'>

export interface WalletConnectRequest {
  provider: WalletProvider
  network: Network
  walletId: string
}

export interface WalletConnection {
  connectionId: string
  walletId: string
  provider: WalletProvider
  network: Network
  address: string
  connectedAt: ISODateTime
}

/* ───────────────────────── Orders ───────────────────────── */

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface BuyerInfo {
  displayName: string
  username: string
  profileName: string
  email: string
  ensName: string
  referralCode: string
  note?: string
}

export interface CreateOrderRequest {
  quoteId: string
  /** the client echoes the totals it showed to the user; the server re-validates */
  expectedTotal: EthAmount
  connectionId: string
  walletId: string
  network: Network
  buyer: BuyerInfo
}

export interface OrderLine {
  nftId: string
  edition: EditionId
  name: string
  tokenId: string
  image: string
  quantity: number
  unitPrice: EthAmount
  lineTotal: EthAmount
}

/** Immutable receipt snapshot — catalog changes never alter it. */
export interface Order {
  id: string
  status: OrderStatus
  version: number
  idempotencyKey: string
  lines: OrderLine[]
  subtotal: EthAmount
  discount: EthAmount
  coupon: string | null
  networkFee: EthAmount
  total: EthAmount
  network: Network
  walletProvider: WalletProvider
  walletAddress: string
  txHash: string | null
  explorerUrl: string | null
  declineReason: string | null
  createdAt: ISODateTime
  settledAt: ISODateTime | null
}
