import type { CartLineInput, Nft, Order, Quote, Wallet, WalletConnection } from '@/contracts/api'
import { buildCatalog, fixtureWallets, FIXTURE_USERS, type UserRecord } from './fixtures'
import { buildScenario, DEFAULT_SCENARIO, type ScenarioConfig, type RouteKey } from './scenarios'

/**
 * In-browser "database" for the mock server. It is the single source of truth for
 * REST handlers *and* Socket.IO events. Persisted to localStorage so refreshes keep
 * the state; `resetDb()` restores the exact fixture snapshot.
 */

export interface CartRecord {
  id: string
  userId: string | null
  lines: CartLineInput[]
  version: number
  updatedAt: string
}

export interface QuoteRecord extends Quote {
  cartId: string
  userId: string | null
}

export interface OrderRecord extends Order {
  userId: string
  requestHash: string
  settlesAt: number
  outcome: 'confirmed' | 'declined'
  /** quantities removed from the cart on confirmation */
  purchased: CartLineInput[]
}

export interface DbState {
  schema: 1
  nfts: Record<string, Nft>
  nftOrder: string[]
  users: Record<string, UserRecord>
  sessions: Record<string, { userId: string; expiresAt: number }>
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord>
  userCart: Record<string, string>
  quotes: Record<string, QuoteRecord>
  orders: Record<string, OrderRecord>
  idempotency: Record<string, { orderId: string; requestHash: string }>
  wallets: Record<string, Wallet[]>
  connections: Record<string, WalletConnection & { userId: string }>
  seq: number
  /** per-scenario one-shot flags (e.g. "timeout already happened") */
  consumed: Record<string, number>
}

const DB_KEY = 'kurio.mock.db.v1'
const SCENARIO_KEY = 'kurio.mock.scenario.v1'

function seed(): DbState {
  const nfts = buildCatalog()
  return {
    schema: 1,
    nfts: Object.fromEntries(nfts.map((n) => [n.id, n])),
    nftOrder: nfts.map((n) => n.id),
    users: Object.fromEntries(FIXTURE_USERS.map((u) => [u.id, structuredClone(u)])),
    sessions: {},
    favorites: { u_ana: ['emerald-ape-042', 'ivory-baron-088'], u_bruno: [] },
    carts: {},
    userCart: {},
    quotes: {},
    orders: {},
    idempotency: {},
    wallets: fixtureWallets(),
    connections: {},
    seq: 1000,
    consumed: {},
  }
}

const storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage

function load(): DbState {
  try {
    const raw = storage?.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schema === 1) return parsed
    }
  } catch {
    /* corrupted state → reseed */
  }
  return seed()
}

export let db: DbState = load()
let lastDbRaw: string | null = storage?.getItem(DB_KEY) ?? null

export function persist() {
  const raw = JSON.stringify(db)
  storage?.setItem(DB_KEY, raw)
  lastDbRaw = raw
}

/**
 * Every open tab runs its own MSW worker client with an in-memory copy of the DB.
 * Before handling anything, adopt the latest state another tab may have persisted, so
 * all tabs behave like clients of ONE backend (sessions, carts, orders, catalog).
 */
export function syncFromStorage() {
  if (!storage) return
  const raw = storage.getItem(DB_KEY)
  if (raw && raw !== lastDbRaw) {
    try {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schema === 1) {
        db = parsed
        lastDbRaw = raw
      }
    } catch {
      /* keep the current state */
    }
  }
  const scenarioRaw = storage.getItem(SCENARIO_KEY)
  if (scenarioRaw && scenarioRaw !== lastScenarioRaw) {
    try {
      scenario = { ...DEFAULT_SCENARIO, ...(JSON.parse(scenarioRaw) as ScenarioConfig) }
      lastScenarioRaw = scenarioRaw
    } catch {
      /* ignore */
    }
  }
}

export function nextId(prefix: string) {
  db.seq += 1
  return `${prefix}_${db.seq.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
}

/* ───────── scenario ───────── */

function loadScenario(): ScenarioConfig {
  try {
    const raw = storage?.getItem(SCENARIO_KEY)
    if (raw) return { ...DEFAULT_SCENARIO, ...(JSON.parse(raw) as ScenarioConfig) }
  } catch {
    /* ignore */
  }
  return buildScenario('padrao')
}

export let scenario: ScenarioConfig = loadScenario()
let lastScenarioRaw: string | null = storage?.getItem(SCENARIO_KEY) ?? null
const failureCounters: Partial<Record<RouteKey, number>> = {}
let requestCounter = 0

export function setScenario(next: ScenarioConfig) {
  scenario = next
  for (const k of Object.keys(failureCounters)) delete failureCounters[k as RouteKey]
  requestCounter = 0
  db.consumed = {}
  persist()
  lastScenarioRaw = JSON.stringify(next)
  storage?.setItem(SCENARIO_KEY, lastScenarioRaw)
}

export function bumpFailureCounter(key: RouteKey) {
  failureCounters[key] = (failureCounters[key] ?? 0) + 1
  return failureCounters[key]!
}

export function nextRequestIndex() {
  requestCounter += 1
  return requestCounter
}

/** Consume a one-shot scenario flag; returns true the first time only. */
export function consumeOnce(flag: string) {
  if (db.consumed[flag]) return false
  db.consumed[flag] = Date.now()
  persist()
  return true
}

/* ───────── reset ───────── */

type ResetListener = () => void
const resetListeners = new Set<ResetListener>()
export function onReset(fn: ResetListener) {
  resetListeners.add(fn)
  return () => resetListeners.delete(fn)
}

export function resetDb(options: { keepScenario?: boolean } = {}) {
  db = seed()
  persist()
  if (!options.keepScenario) setScenario(buildScenario('padrao'))
  resetListeners.forEach((fn) => fn())
}
