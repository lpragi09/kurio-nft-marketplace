import type { CatalogSort, CatalogTab, CollectionCategory, Network, NftListParams } from '@/contracts/api'
import { NETWORKS } from '@/contracts/api'
import { isEthString } from '@/lib/eth'

/** URL state of the catalog (Portuguese, human-readable keys). */
export interface CatalogSearch {
  q?: string
  cat?: string // comma-separated CollectionCategory
  rede?: string // comma-separated Network
  min?: string
  max?: string
  aba?: CatalogTab
  ordem?: CatalogSort
  pagina?: number
}

export const CATEGORY_LABELS: Record<CollectionCategory, string> = {
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
export const CATEGORIES = Object.keys(CATEGORY_LABELS) as CollectionCategory[]

export const NETWORK_LABELS: Record<Network, string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }

export const TAB_LABELS: Record<CatalogTab, string> = { todos: 'Todos os NFTs', novos: 'Novos lançamentos', 'em-alta': 'Em alta' }
export const SORT_LABELS: Record<CatalogSort, string> = {
  recentes: 'Listados recentemente',
  'preco-asc': 'Menor preço',
  'preco-desc': 'Maior preço',
  nome: 'Nome (A–Z)',
}

const TABS = Object.keys(TAB_LABELS) as CatalogTab[]
const SORTS = Object.keys(SORT_LABELS) as CatalogSort[]

function csv<T extends string>(raw: unknown, allowed: readonly T[]): string | undefined {
  if (typeof raw !== 'string') return undefined
  const list = [...new Set(raw.split(','))].filter((v): v is T => (allowed as readonly string[]).includes(v))
  return list.length ? list.sort().join(',') : undefined
}

/** Tolerant parser: invalid values are dropped instead of breaking the page. */
export function validateCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const page = Number(raw.pagina)
  const q = typeof raw.q === 'string' ? raw.q.trim().slice(0, 80) : undefined
  const num = (v: unknown) => (typeof v === 'string' || typeof v === 'number') && isEthString(String(v)) ? String(v) : undefined
  return {
    q: q || undefined,
    cat: csv(raw.cat, CATEGORIES),
    rede: csv(raw.rede, NETWORKS),
    min: num(raw.min),
    max: num(raw.max),
    aba: TABS.includes(raw.aba as CatalogTab) && raw.aba !== 'todos' ? (raw.aba as CatalogTab) : undefined,
    ordem: SORTS.includes(raw.ordem as CatalogSort) && raw.ordem !== 'recentes' ? (raw.ordem as CatalogSort) : undefined,
    pagina: Number.isInteger(page) && page > 1 ? page : undefined,
  }
}

export const PAGE_SIZE = 9

export function toListParams(s: CatalogSearch): NftListParams {
  return {
    q: s.q,
    categories: s.cat ? (s.cat.split(',') as CollectionCategory[]) : undefined,
    networks: s.rede ? (s.rede.split(',') as Network[]) : undefined,
    minPrice: s.min,
    maxPrice: s.max,
    tab: s.aba ?? 'todos',
    sort: s.ordem ?? 'recentes',
    page: s.pagina ?? 1,
    pageSize: PAGE_SIZE,
  }
}

export function toggleCsv(current: string | undefined, value: string): string | undefined {
  const set = new Set(current ? current.split(',') : [])
  if (set.has(value)) set.delete(value)
  else set.add(value)
  return set.size ? [...set].sort().join(',') : undefined
}
