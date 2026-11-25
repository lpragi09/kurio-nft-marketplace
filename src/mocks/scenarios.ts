/**
 * Network/failure scenarios for the MSW layer. A scenario is a plain, serialisable
 * config persisted in localStorage so it survives reloads and can be set from the
 * URL (?scenario=<name>), the dev panel, or Playwright (POST /__mock/scenario).
 */

export type RouteKey =
  | 'nfts:list'
  | 'nfts:detail'
  | 'favorites:read'
  | 'favorites:write'
  | 'cart:read'
  | 'cart:write'
  | 'quote'
  | 'orders:create'
  | 'orders:read'
  | 'auth'
  | 'profile'
  | 'wallets'

export interface FailureRule {
  /** 'timeout' = the request never gets an answer (the client gives up after its timeout) */
  kind?: 'http' | 'timeout'
  status: number
  code: 'INTERNAL' | 'TRANSIENT' | 'FORBIDDEN' | 'UNAUTHENTICATED'
  /** fail only the first N matching requests, then succeed (omit = always) */
  times?: number
}

export interface ScenarioConfig {
  name: ScenarioName
  latency:
    | { mode: 'fixed'; ms: number }
    | { mode: 'variable'; minMs: number; maxMs: number; seed: number }
    /** alternates slow/fast so earlier requests resolve after later ones */
    | { mode: 'out-of-order'; slowMs: number; fastMs: number }
  offline: boolean
  failures: Partial<Record<RouteKey, FailureRule>>
  emptyCatalog: boolean
  sessionTtlSeconds: number
  order: {
    outcome: 'confirmed' | 'declined'
    settleMs: number
    /** the first create request commits the order but never answers (client times out) */
    timeoutAfterCreate: boolean
    /** first create request: bump the price of the first line and reply QUOTE_STALE */
    priceChangeOnCheckout: boolean
    /** first create request: sell out the first line's edition and reply AVAILABILITY_CONFLICT */
    soldOutOnCheckout: boolean
  }
  wallet: { rejectConnection: boolean }
  realtime: { duplicateEvents: boolean }
}

export type ScenarioName =
  | 'padrao'
  | 'lento'
  | 'latencia-variavel'
  | 'fora-de-ordem'
  | 'offline'
  | 'erro-servidor'
  | 'falha-transitoria'
  | 'timeout-catalogo'
  | 'catalogo-vazio'
  | 'favoritos-falha'
  | 'sessao-curta'
  | 'acesso-negado'
  | 'preco-alterado'
  | 'edicao-esgotada'
  | 'pedido-timeout'
  | 'pagamento-recusado'
  | 'carteira-recusada'
  | 'eventos-duplicados'

export const DEFAULT_SCENARIO: ScenarioConfig = {
  name: 'padrao',
  latency: { mode: 'fixed', ms: 120 },
  offline: false,
  failures: {},
  emptyCatalog: false,
  sessionTtlSeconds: 60 * 60 * 8,
  order: {
    outcome: 'confirmed',
    settleMs: 2500,
    timeoutAfterCreate: false,
    priceChangeOnCheckout: false,
    soldOutOnCheckout: false,
  },
  wallet: { rejectConnection: false },
  realtime: { duplicateEvents: false },
}

type Patch = Partial<Omit<ScenarioConfig, 'order' | 'wallet' | 'realtime'>> & {
  order?: Partial<ScenarioConfig['order']>
  wallet?: Partial<ScenarioConfig['wallet']>
  realtime?: Partial<ScenarioConfig['realtime']>
}

export const SCENARIOS: Record<ScenarioName, { label: string; description: string; patch: Patch }> = {
  padrao: { label: 'Padrão', description: 'Sucesso com latência baixa e fixa (120 ms).', patch: {} },
  lento: { label: 'Rede lenta', description: 'Todas as respostas levam 2,5 s (skeletons visíveis).', patch: { latency: { mode: 'fixed', ms: 2500 } } },
  'latencia-variavel': {
    label: 'Latência variável',
    description: 'Atraso pseudoaleatório determinístico entre 200 ms e 1,8 s.',
    patch: { latency: { mode: 'variable', minMs: 200, maxMs: 1800, seed: 42 } },
  },
  'fora-de-ordem': {
    label: 'Respostas fora de ordem',
    description: 'Requisições alternam 1,5 s / 150 ms; a mais antiga chega depois.',
    patch: { latency: { mode: 'out-of-order', slowMs: 1500, fastMs: 150 } },
  },
  offline: { label: 'Sem conexão', description: 'Toda requisição falha na rede e o socket é recusado.', patch: { offline: true } },
  'erro-servidor': {
    label: 'Erro 500 no catálogo',
    description: 'Listagem e detalhe respondem 500 até o cenário ser trocado.',
    patch: { failures: { 'nfts:list': { status: 500, code: 'INTERNAL' }, 'nfts:detail': { status: 500, code: 'INTERNAL' } } },
  },
  'falha-transitoria': {
    label: 'Falha transitória (503)',
    description: 'As 2 primeiras chamadas do catálogo respondem 503; a nova tentativa funciona.',
    patch: { failures: { 'nfts:list': { status: 503, code: 'TRANSIENT', times: 2 } } },
  },
  'timeout-catalogo': {
    label: 'Timeout no catálogo',
    description: 'As 2 primeiras listagens nunca respondem (timeout do cliente em 10 s); a nova tentativa funciona.',
    patch: { failures: { 'nfts:list': { kind: 'timeout', status: 504, code: 'TRANSIENT', times: 2 } } },
  },
  'catalogo-vazio': { label: 'Catálogo vazio', description: 'A busca nunca encontra NFTs.', patch: { emptyCatalog: true } },
  'favoritos-falha': {
    label: 'Falha ao favoritar',
    description: 'Incluir/remover favorito responde 500 (rollback otimista).',
    patch: { failures: { 'favorites:write': { status: 500, code: 'INTERNAL' } } },
  },
  'sessao-curta': { label: 'Sessão curta', description: 'Tokens expiram 45 s após o login.', patch: { sessionTtlSeconds: 45 } },
  'acesso-negado': {
    label: 'Acesso negado (403)',
    description: 'Rotas de perfil respondem 403.',
    patch: { failures: { profile: { status: 403, code: 'FORBIDDEN' } } },
  },
  'preco-alterado': {
    label: 'Preço alterado na compra',
    description: 'Ao confirmar, o preço do 1º item sobe e a API exige nova confirmação.',
    patch: { order: { priceChangeOnCheckout: true } },
  },
  'edicao-esgotada': {
    label: 'Edição esgotada na compra',
    description: 'Ao confirmar, a edição do 1º item esgota (409).',
    patch: { order: { soldOutOnCheckout: true } },
  },
  'pedido-timeout': {
    label: 'Timeout após criar pedido',
    description: 'O 1º envio cria o pedido mas não responde; o reenvio recupera o mesmo pedido.',
    patch: { order: { timeoutAfterCreate: true } },
  },
  'pagamento-recusado': { label: 'Pagamento recusado', description: 'O pedido fica pendente e é recusado.', patch: { order: { outcome: 'declined' } } },
  'carteira-recusada': { label: 'Carteira recusa conexão', description: 'A conexão simulada da carteira é recusada.', patch: { wallet: { rejectConnection: true } } },
  'eventos-duplicados': {
    label: 'Eventos duplicados/antigos',
    description: 'Cada evento Socket.IO é enviado duas vezes, seguido de uma versão antiga.',
    patch: { realtime: { duplicateEvents: true } },
  },
}

export function buildScenario(name: ScenarioName): ScenarioConfig {
  const { patch } = SCENARIOS[name]
  return {
    ...DEFAULT_SCENARIO,
    ...patch,
    name,
    failures: { ...patch.failures },
    order: { ...DEFAULT_SCENARIO.order, ...patch.order },
    wallet: { ...DEFAULT_SCENARIO.wallet, ...patch.wallet },
    realtime: { ...DEFAULT_SCENARIO.realtime, ...patch.realtime },
  }
}

export function isScenarioName(v: unknown): v is ScenarioName {
  return typeof v === 'string' && v in SCENARIOS
}
