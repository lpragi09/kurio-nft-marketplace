import type {
  CollectionCategory,
  EditionId,
  Network,
  Nft,
  NftEdition,
  User,
  Wallet,
} from '@/contracts/api'
import { eth } from '@/lib/eth'

/** Deterministic PRNG so every reset produces exactly the same catalog. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Art = 'emerald-ape' | 'sage-nomad' | 'ivory-baron' | 'golden-beat'

const ART_ALT: Record<Art, string> = {
  'emerald-ape': 'Macaco de pelo castanho com óculos redondos verdes, jaqueta college verde e colar de esmeralda',
  'sage-nomad': 'Gorila grisalho com chapéu bucket verde-oliva e moletom roxo',
  'ivory-baron': 'Gorila de pelo escuro com brinco, blazer marfim e gola alta verde',
  'golden-beat': 'Orangotango dourado com fones de ouvido verdes e jaqueta creme',
}

const CATEGORY_NAMES: Record<CollectionCategory, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}
export { CATEGORY_NAMES }

/** The first 9 items reproduce the Figma home grid exactly. */
const FIGMA_ITEMS: {
  name: string
  token: string
  art: Art
  price: string
  compareAt?: string
  category: CollectionCategory
  network: Network
  rarity?: 'raro'
}[] = [
  { name: 'Emerald Ape', token: '042', art: 'emerald-ape', price: '1.19', category: 'arte-digital', network: 'ethereum' },
  { name: 'Sage Nomad', token: '009', art: 'sage-nomad', price: '1.69', category: 'arte-digital', network: 'ethereum' },
  { name: 'Neon Vessel', token: '552', art: 'ivory-baron', price: '1.99', compareAt: '2.29', category: 'arte-3d', network: 'polygon', rarity: 'raro' },
  { name: 'Cosmic Bloom', token: '118', art: 'sage-nomad', price: '1.29', category: 'generativa', network: 'ethereum' },
  { name: 'Violet Nomad', token: '314', art: 'sage-nomad', price: '1.39', category: 'arte-digital', network: 'polygon' },
  { name: 'Ivory Baron', token: '088', art: 'ivory-baron', price: '1.79', category: 'colecionaveis', network: 'ethereum', rarity: 'raro' },
  { name: 'Golden Beat', token: '207', art: 'golden-beat', price: '0.99', category: 'musica', network: 'solana' },
  { name: 'Amber Pulse', token: '733', art: 'golden-beat', price: '0.89', category: 'musica', network: 'polygon' },
  { name: 'Golden Signal', token: '160', art: 'golden-beat', price: '0.39', category: 'musica', network: 'solana' },
]

const ADJECTIVES = ['Crimson', 'Lunar', 'Velvet', 'Quiet', 'Electric', 'Rustic', 'Solar', 'Hidden', 'Copper', 'Jade', 'Midnight', 'Wild', 'Silver', 'Desert', 'Cobalt', 'Saffron']
const NOUNS = ['Ape', 'Nomad', 'Baron', 'Beat', 'Monk', 'Drifter', 'Echo', 'Oracle', 'Rider', 'Scholar', 'Pilot', 'Mystic']
const NOUN_ART: Record<string, Art> = {
  Ape: 'emerald-ape', Monk: 'emerald-ape', Rider: 'emerald-ape',
  Nomad: 'sage-nomad', Drifter: 'sage-nomad', Scholar: 'sage-nomad',
  Baron: 'ivory-baron', Oracle: 'ivory-baron', Mystic: 'ivory-baron',
  Beat: 'golden-beat', Echo: 'golden-beat', Pilot: 'golden-beat',
}
const CATEGORIES = Object.keys(CATEGORY_NAMES) as CollectionCategory[]
const NETS: Network[] = ['ethereum', 'polygon', 'solana']
const ATTRS: Record<Art, string[]> = {
  'emerald-ape': ['Óculos', 'Esmeralda', 'Raro'],
  'sage-nomad': ['Chapéu bucket', 'Moletom', 'Comum'],
  'ivory-baron': ['Blazer', 'Brinco', 'Raro'],
  'golden-beat': ['Fones', 'Dourado', 'Incomum'],
}
const COLLECTION_BY_ART: Record<Art, string> = {
  'emerald-ape': 'Kurio Apes',
  'sage-nomad': 'Nomad Club',
  'ivory-baron': 'Baron Society',
  'golden-beat': 'Golden Frequencies',
}

export const CATALOG_SIZE = 72
const BASE_DATE = Date.UTC(2026, 9, 1, 12, 0, 0) // 1 Oct 2026

function editionsFor(base: string, rand: () => number, index: number): NftEdition[] {
  const b = eth(base)
  const avail = (max: number) => Math.floor(rand() * (max + 1))
  const editions: NftEdition[] = [
    { id: '1/1', price: b.times(3).round(2).toString(), available: index % 4 === 1 ? 0 : 1, maxPerOrder: 1 },
    { id: '1/10', price: b.times(1.5).round(2).toString(), available: Math.max(0, avail(10)), maxPerOrder: 10 },
    { id: '1/50', price: b.toString(), available: 10 + avail(40), maxPerOrder: 10 },
    { id: 'aberta', price: b.times(0.6).round(2).toString(), available: 999, maxPerOrder: 20 },
  ]
  // "Golden Signal" demonstrates an edition that is unavailable but listed.
  if (index === 8) editions[3]!.available = 0
  return editions
}

function makeNft(
  index: number,
  seed: {
    name: string
    token: string
    art: Art
    price: string
    compareAt?: string
    category: CollectionCategory
    network: Network
    rarity?: 'raro'
  },
  rand: () => number,
): Nft {
  const id = `${seed.name.toLowerCase().replace(/\s+/g, '-')}-${seed.token}`
  const editions = editionsFor(seed.price, rand, index)
  const networkName = seed.network === 'ethereum' ? 'Ethereum' : seed.network === 'polygon' ? 'Polygon' : 'Solana'
  const fullName = `${seed.name} #${seed.token}`
  return {
    id,
    tokenId: `#${seed.token.padStart(4, '0')}`,
    name: fullName,
    image: `/nfts/${seed.art}`,
    imageAlt: ART_ALT[seed.art],
    category: seed.category,
    network: seed.network,
    price: seed.price,
    compareAtPrice: seed.compareAt,
    rarity: seed.rarity,
    listedAt: new Date(BASE_DATE - index * 36e5 * 7).toISOString(),
    trendingScore: Math.round(((index * 37) % 101) + rand() * 20),
    soldOut: false,
    version: 1,
    description: `Um colecionável digital 1/50 finalizado à mão da coleção Kurio Editions, verificado na ${networkName}, com arte desbloqueável e acesso para colecionadores.`,
    longDescription: [
      `${fullName} é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na ${networkName}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
      'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
    ],
    collectionName: COLLECTION_BY_ART[seed.art],
    attributes: ATTRS[seed.art],
    rating: 4.8,
    reviewCount: 19 + (index % 7),
    contractAddress: `0x7A42${(index * 7919).toString(16).padStart(6, '0').toUpperCase()}19E8`,
    royaltyPercent: 5,
    gallery: [`/nfts/${seed.art}`, `/nfts/${seed.art}`, `/nfts/${seed.art}`, `/nfts/${seed.art}`],
    editions,
  }
}

export function buildCatalog(): Nft[] {
  const rand = mulberry32(20261124)
  const list: Nft[] = FIGMA_ITEMS.map((seed, i) => makeNft(i, seed, rand))
  for (let i = FIGMA_ITEMS.length; i < CATALOG_SIZE; i++) {
    const adj = ADJECTIVES[i % ADJECTIVES.length]!
    const noun = NOUNS[(i * 5) % NOUNS.length]!
    const art = NOUN_ART[noun]!
    const price = eth(0.05 + rand() * 12.2).round(2).toString()
    list.push(
      makeNft(
        i,
        {
          name: `${adj} ${noun}`,
          token: String(100 + ((i * 53) % 900)),
          art,
          price,
          category: CATEGORIES[(i * 7) % CATEGORIES.length]!,
          network: NETS[(i * 3 + Math.floor(i / 5)) % NETS.length]!,
          rarity: i % 11 === 0 ? 'raro' : undefined,
        },
        rand,
      ),
    )
  }
  // A completely sold-out NFT (all editions at zero) for the "esgotado" state.
  const soldOut = list[20]!
  soldOut.editions = soldOut.editions.map((e) => ({ ...e, available: 0 }))
  soldOut.soldOut = true
  return list
}

export interface UserRecord extends User {
  passwordSalt: string
  passwordHash: string
}

export const FIXTURE_USERS: UserRecord[] = [
  {
    id: 'u_ana',
    username: 'ana.colecionadora',
    email: 'ana@kurio.test',
    displayName: 'Ana Souza',
    ensName: 'ana',
    walletNickname: 'Principal da Ana',
    avatarUrl: null,
    passwordSalt: 'ana-salt-7f3a',
    passwordHash: '5a7358551f9d3113ddebba739ac19e0e87dbe8ba88f2e856b6387de112197201',
  },
  {
    id: 'u_bruno',
    username: 'bruno.nft',
    email: 'bruno@kurio.test',
    displayName: 'Bruno Lima',
    ensName: 'bruno',
    walletNickname: 'Carteira do Bruno',
    avatarUrl: null,
    passwordSalt: 'bruno-salt-91c2',
    passwordHash: '0af4dda0cc90cc52f383eb21a6dcfa1c50f2bbaec42df417274074b23d1a312f',
  },
]

export function fixtureWallets(): Record<string, Wallet[]> {
  const now = new Date(BASE_DATE).toISOString()
  return {
    u_ana: [
      {
        id: 'w_ana_primary',
        slot: 'primary',
        displayName: 'Ana Souza',
        nickname: 'Principal',
        profileName: 'ana.kurio',
        network: 'ethereum',
        address: '0xA91F3c2B7d4E5f60718293aB4c5D6e7F8091E82C',
        secondaryAddress: 'nova.kurio.eth',
        provider: 'metamask',
        referralCode: 'KURIO-ANA',
        email: 'ana@kurio.test',
        ensName: 'ana',
        updatedAt: now,
      },
      {
        id: 'w_ana_secondary',
        slot: 'secondary',
        displayName: 'Ana Souza',
        nickname: 'Reserva',
        profileName: 'ana.reserva',
        network: 'polygon',
        address: '0x5B1e2D3c4F5a6B7c8D9e0F1a2B3c4D5e6F7a8B9C',
        secondaryAddress: null,
        provider: 'coinbase',
        referralCode: 'KURIO-ANA',
        email: 'ana@kurio.test',
        ensName: 'nova.kurio',
        updatedAt: now,
      },
    ],
    // Bruno starts without wallets so the "cadastrar carteira" path is exercised.
    u_bruno: [],
  }
}

export interface CouponRecord {
  code: string
  percentOff: number
  expiresAt: string
}

export const COUPONS: CouponRecord[] = [
  { code: 'KURIO10', percentOff: 10, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'GENESIS20', percentOff: 20, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'VERAO24', percentOff: 15, expiresAt: '2025-03-20T00:00:00.000Z' },
]

export const NETWORK_FEES: Record<Network, string> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
}

export const EDITION_ORDER: EditionId[] = ['1/1', '1/10', '1/50', 'aberta']
