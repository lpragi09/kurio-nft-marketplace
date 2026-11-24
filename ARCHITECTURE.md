# Arquitetura

## Visão geral

```
src/
├─ contracts/        contratos tipados compartilhados por cliente e mock
│  ├─ api.ts         tipos REST (requests, responses, códigos de erro)
│  ├─ events.ts      envelopes Socket.IO (nft.updated, order.updated)
│  └─ schemas.ts     validação Zod usada pelos formulários E pelos handlers MSW
├─ api/              Axios (http.ts: interceptors, ApiError) + endpoints tipados
├─ queries/          TanStack Query: chaves, QueryClient, hooks e mutations
├─ realtime/         RealtimeClient (socket.io-client → cache do Query)
├─ session/          sessão (store externa), login/logout/expiração
├─ routes/           TanStack Router (file-based): /, /nft/$nftId, /carrinho,
│                    /entrar, /cadastro, /_auth/{pagamento, pedido/$orderId,
│                    perfil, perfil/carteiras, favoritos}
├─ features/         telas (catálogo, detalhe, carrinho, checkout, pedido, auth, perfil)
├─ components/       ui/ (shadcn adaptado), kurio/ (design system), layout/
├─ app/              bootstrap, ponte de tempo real, watcher de sessão, painel de cenários
└─ mocks/            servidor simulado (MSW): fixtures, db, serviço, handlers, socket, cenários
```

Fluxo de dados: **componente → hook (Query) → endpoint (Axios) → MSW handler → serviço do mock → db**. O mock emite eventos pelo **Socket.IO simulado → `socket.io-client` → RealtimeClient → cache do Query → componente**. Componentes, hooks e o cliente Axios não contêm dados fictícios nem caminhos alternativos: toda simulação vive em `src/mocks/`.

## Contratos REST

Base `/api`. Autenticação por `Authorization: Bearer <token>` (token opaco). O carrinho do visitante é identificado por `X-Guest-Cart-Id` (UUID salvo no localStorage). Erros sempre no formato:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { "email": "…" }, "details": {} } }
```

| Código | HTTP | Uso |
| --- | --- | --- |
| `VALIDATION_ERROR` | 422/400 | validação (com `fields`) |
| `UNAUTHENTICATED` | 401 | sem token / credenciais inválidas |
| `SESSION_EXPIRED` | 401 | token expirado ou revogado |
| `FORBIDDEN` | 403 | recurso de outro usuário (ex.: pedido) |
| `NOT_FOUND` | 404 | NFT, pedido, carteira ou rota inexistente |
| `CONFLICT` | 409 | e-mail/usuário/endereço já usado |
| `AVAILABILITY_CONFLICT` | 409 | edição esgotada / quantidade acima do disponível |
| `QUOTE_STALE` | 409 | preço, taxa, cupom ou disponibilidade mudou (`details.quote` traz a cotação nova) |
| `IDEMPOTENCY_CONFLICT` | 409 | mesma `Idempotency-Key` com outro conteúdo |
| `COUPON_INVALID` / `COUPON_EXPIRED` | 422 | cupom |
| `WALLET_REJECTED` | 409 | carteira recusou / conexão inválida |
| `TRANSIENT` | 503 | falha transitória (o cliente pode tentar de novo) |
| `INTERNAL` | 500 | erro interno |

| Recurso | Endpoints |
| --- | --- |
| Sessão e conta | `POST /auth/register` → `Session` (201) · `POST /auth/login` → `Session` · `GET /auth/session` → `{user, expiresAt}` · `POST /auth/logout` (204) |
| NFTs | `GET /nfts?q&categories&networks&minPrice&maxPrice&tab&sort&page&pageSize&ids` → `NftListResponse` (itens + paginação + facetas) · `GET /nfts/:id` → `Nft` |
| Favoritos | `GET /me/favorites` · `PUT /me/favorites/:nftId` · `DELETE /me/favorites/:nftId` → `{nftIds}` |
| Carrinho | `GET /cart` · `POST /cart/items {nftId, edition, quantity}` · `PATCH /cart/items/:lineId {quantity}` · `DELETE /cart/items/:lineId` · `POST /cart/merge {guestCartId}` → `Cart` |
| Cotação | `POST /cart/quote {couponCode?, network?}` → `Quote` (linhas com preço unitário e versão do NFT, subtotal, desconto, taxa de rede, total, validade de 10 min) |
| Carteira (conexão simulada) | `POST /wallets/connect {provider, network, walletId}` → `WalletConnection` · `DELETE /wallets/connections/:id` |
| Pedidos | `POST /orders` + header `Idempotency-Key` → `Order` (201; 200 em replay) · `GET /orders?status` · `GET /orders/:id` |
| Perfil | `GET /me/profile` · `PUT /me/profile` · `PUT /me/avatar {dataUrl}` · `DELETE /me/avatar` · `POST /me/password` (204) |
| Carteiras | `GET /me/wallets` · `POST /me/wallets {slot, …}` · `PUT /me/wallets/:id` |

Os tipos completos estão em `src/contracts/api.ts`. Valores em ETH trafegam como **strings decimais** e são calculados com `big.js` (18 casas, `ROUND_HALF_EVEN`), tanto no mock quanto no cliente. Nenhum `Number` é usado para dinheiro. Quantidades são inteiros validados nos dois lados.

### Pedido idempotente

1. O cliente gera uma `Idempotency-Key` por tentativa, identificada por `(quoteId, walletId, network, connectionId, expectedTotal)`, e salva tentativa + corpo no localStorage **antes** de enviar.
2. O servidor guarda `userId:key → (orderId, hash do corpo)`. Mesma chave e mesmo corpo devolvem o **mesmo pedido** (200, `Idempotent-Replayed`). Mesma chave com outro corpo dá `409 IDEMPOTENCY_CONFLICT`.
3. Antes de criar, o servidor **revalida a cotação** (preço, disponibilidade, cupom, taxa, validade) e compara `expectedTotal`. Qualquer divergência gera `409 QUOTE_STALE`/`AVAILABILITY_CONFLICT`, e a UI exige nova confirmação.
4. Criado o pedido (`pending`), o estoque é reservado (emitindo `nft.updated`) e a liquidação é agendada (`settlesAt`). Ao confirmar, só as quantidades compradas saem do carrinho; ao recusar, o estoque é devolvido. `confirmed` e `declined` são terminais.
5. O recibo é um **snapshot** (linhas, preços, taxas, total) gravado na criação. Mudanças posteriores no catálogo não o alteram.

Timeout após a criação: o POST de pedidos tem timeout de 6 s. Em `TIMEOUT`/`NETWORK`, o cliente reenvia uma vez com a mesma chave. Se a página recarregar, a tentativa salva é retomada ("Verificar pedido") e o pedido pendente é recuperado por `GET /orders/:id`. Cliques repetidos são bloqueados (botão desabilitado + guarda síncrona com `ref`).

## Eventos Socket.IO

Envelope comum (`src/contracts/events.ts`):

```ts
{ eventId, type, resource: { kind: 'nft' | 'order', id }, version, occurredAt, userId?, data }
```

| Evento | Destinatários | `data` | Efeito no cliente |
| --- | --- | --- | --- |
| `nft.updated` | todas as conexões | `{ price, soldOut, editions[{id, price, available}] }` | atualiza detalhe e páginas de catálogo em cache (`setQueryData`, só se `version` for maior); para carrinhos que contêm o NFT, mostra aviso (`aria-live`) e invalida carrinho e cotação; sinaliza o checkout, que marca a cotação em revisão como desatualizada e bloqueia a confirmação |
| `order.updated` | apenas sockets autenticados do dono | `{ status }` | atualiza o pedido; ignora eventos de outro `userId`; invalida o recibo e, se confirmado, o carrinho |

**Ordenação e idempotência:** o cliente guarda os `eventId` já vistos (LRU de 500) e a maior `version` por recurso. Duplicatas e versões antigas são descartadas, então nunca regridem o estado nem reaplicam efeitos. Se um GET estiver em andamento quando o evento chega, a query é invalidada para que a resposta antiga não sobrescreva o dado novo.

**Reconexão:** em todo `connect` após o primeiro, as queries ativas de `nfts`, `cart` e `orders` são invalidadas, reconciliando com o REST. Enquanto o socket está fora, o pedido pendente faz polling a cada 3 s, e um banner acessível indica "reconectando".

**Ciclo de vida:** um socket por sessão (`RealtimeBridge`, dependente de token e usuário). Login, logout e troca de usuário destroem o socket anterior (`removeAllListeners` + `disconnect`) antes de abrir outro com o novo token, de modo que eventos de uma sessão anterior não alcançam a seguinte.

### Transporte no ambiente de mocks e limitações

- O `socket.io-client` real conecta em `wss://realtime.kurio.test` com `transports: ['websocket']`. O MSW intercepta o WebSocket (`ws.link`) e o `@mswjs/socket.io-binding` codifica e decodifica o protocolo Engine.IO/Socket.IO.
- O binding responde o handshake com `pingInterval` de 25 s. O mock envia pings Engine.IO a cada 20 s para manter a conexão.
- O `engine.io-client` captura o construtor `WebSocket` quando o módulo é avaliado. Por isso o `socket.io-client` é importado dinamicamente **depois** que o worker do MSW sobe.
- O MSW remove o prefixo `/socket.io/` antes de casar a URL, então o `ws.link` usa o host inteiro (`wss://realtime.kurio.test/*`).
- Limitações: não há namespaces, rooms nem polling HTTP. A autenticação vai em query string (`?token=`) em vez do pacote de auth do Socket.IO. Tudo roda numa única aba: cada aba tem seu próprio servidor simulado (o estado é compartilhado pelo localStorage, mas eventos não cruzam abas).
- Versão: MSW 2.15 (o binding ainda não suporta MSW 3).

## Mock server

- `fixtures.ts`: 72 NFTs determinísticos (PRNG com seed). Os 9 primeiros reproduzem o grid do Figma, com 9 coleções, 3 redes, 4 edições por NFT, preços de 0,05 a 12,3 ETH e casos de edição esgotada e NFT inteiro esgotado. Também traz 2 usuários (senha em hash), carteiras, cupons e taxas por rede.
- `db.ts`: estado único (catálogo, sessões, favoritos, carrinhos, cotações, pedidos, idempotência, carteiras, conexões) persistido no localStorage. `resetDb()` restaura o snapshot.
- `service.ts`: regras de negócio (sessão, limites do carrinho, cotação, revalidação, liquidação de pedidos e retomada de timers após refresh).
- `handlers.ts`: REST + rotas de controle `/__mock/*`. O wrapper `route()` aplica o cenário (offline, latência fixa, variável ou fora de ordem, falhas por rota com contador `times`) e mapeia `ServiceError` para o formato de erro.
- `realtime.ts`: servidor Socket.IO simulado. Toda mutação de NFT ou pedido passa por `updateNft()`/`settleOrder()`, que persistem **e** emitem o evento, mantendo REST e eventos coerentes.
- Ativação: `VITE_ENABLE_MOCKS` (padrão ligado, inclusive no build publicado).

## Estado e cache (TanStack Query)

| Chave | Conteúdo | staleTime |
| --- | --- | --- |
| `['nfts','list', params]` | página do catálogo (params completos, sem colisão) | 30 s, `keepPreviousData` |
| `['nfts','detail', id]` | detalhe | 30 s |
| `['cart', owner]` | carrinho (`owner` = `user:<id>` ou `guest:<uuid>`) | 10 s |
| `['cart', owner, 'quote', {coupon, network, cartVersion}]` | cotação | 15 s |
| `['user', uid, …]` | favoritos, perfil, carteiras, pedidos | 30 s |

- **Retries:** queries tentam de novo uma vez, e só em falhas transitórias (rede, timeout, 503), com backoff. 4xx e 500 aparecem na hora com botão "Tentar novamente". Mutations nunca tentam de novo automaticamente (pedidos dependem da idempotência).
- **Cancelamento e respostas obsoletas:** todo `queryFn` repassa o `AbortSignal` ao Axios. Como as chaves incluem todos os parâmetros, uma resposta fora de ordem só preenche a própria entrada. O cenário `fora-de-ordem` e o teste E2E comprovam isso.
- **Atualização otimista:** favoritos (`onMutate` aplica, `onError` faz rollback do snapshot, `onSettled` invalida).
- **Invalidação:** mutations de carrinho gravam a resposta (`setQueryData`). `AVAILABILITY_CONFLICT` invalida carrinho e catálogo. Eventos invalidam o que tocam. A reconexão invalida as queries ativas.
- **Isolamento por usuário:** dados privados vivem sob `['user', uid]`. Logout, troca de usuário e expiração cancelam e removem essas queries e os carrinhos de usuário, e limpam cupom e checkout.
- **Estados de UI:** skeletons com shimmer (respeitando `prefers-reduced-motion`) e dimensões preservadas, vazio, erro com nova tentativa, sucesso (toasts acessíveis) e atualização em segundo plano ("Atualizando…", conteúdo esmaecido com `keepPreviousData`).

## Sessão

- Token opaco + snapshot do usuário no localStorage (`kurio.session.v1`). A senha nunca é guardada no cliente. No boot e a cada 60 s, `GET /auth/session` valida o token.
- Um 401 `SESSION_EXPIRED`/`UNAUTHENTICATED` em qualquer requisição com o token atual dispara a expiração: limpa os dados privados, avisa o usuário e redireciona para `/entrar?redirect=<rota atual>&motivo=expirada`.
- O contexto é preservado: o carrinho permanece no servidor, o rascunho do checkout fica no `sessionStorage` e o `redirect` devolve o usuário ao fluxo após o login.
- Rotas privadas usam o layout `_auth` (`beforeLoad` com redirect). `/entrar` e `/cadastro` redirecionam se já houver sessão.
- Abas sincronizam login/logout via evento `storage`.

## Carrinho

- Mantido no servidor. Visitante identificado por `X-Guest-Cart-Id`. No login, `POST /cart/merge` funde o carrinho do visitante no do usuário (respeitando limites) e o id de visitante é rotacionado.
- Limites por edição: `min(disponível, máximo por pedido)`. O servidor ajusta linhas quando o estoque cai (`adjusted: 'quantity-reduced' | 'sold-out'`) e a UI sinaliza.
- O cupom é validado pela API antes de ser aplicado. Se depois ficar inválido ou expirar, é removido automaticamente. Subtotal, desconto, taxa e total vêm sempre da cotação da API.

## Acessibilidade

Link "pular para o conteúdo"; foco movido para `<main>` a cada navegação; diálogos e sheets do Radix com foco preso e devolvido; labels em todos os campos (labels visualmente ocultos onde o Figma usa só placeholder); erros associados por `aria-describedby` + `aria-invalid` + `role="alert"`; marcador de obrigatório fora do nome acessível (`aria-required`); estados não dependentes só de cor (riscado + texto "esgotada", `aria-pressed`, `aria-current`); avisos de tempo real e de mutations em `aria-live`; alvos de toque com no mínimo 24 px; sem overflow horizontal em 390, 768 e 1440 px.

## Performance e Lighthouse

Otimizações aplicadas: imagens WebP em 160/400/800 com `srcset`/`sizes` e `width`/`height` fixos; `fetchpriority=high` e preload da arte LCP; code splitting por rota; fonte Roboto Mono self-hosted (somente subset latin); a app renderiza **antes** do worker do MSW ficar pronto (só HTTP e socket aguardam); `min-height` no `<main>` (o CLS do detalhe caiu de 0,70 para 0,006); `robots.txt`; cache imutável de assets.

**Mobile abaixo de 90 em Performance — causa:** no perfil mobile (4G lento + CPU 4× simulados), o LCP é a primeira imagem do catálogo ou a arte do NFT, que dependem dos dados da API. No ambiente de demonstração, a API exige carregar e executar o MSW + interceptors + binding Socket.IO (~176 KB gzip) e registrar o service worker antes da primeira resposta. Essa cadeia (JS do app → JS do mock → SW → resposta → imagem) domina o LCP simulado (~4,8–5,4 s) e o TBT (~250–300 ms). Com um backend real, esse custo some. No desktop, as mesmas páginas ficam em 98–99. A auditoria roda com os mocks, imagens, fontes e funcionalidades reais da entrega, sem atalhos específicos para a pontuação.

## Decisões de UX e desvios do Figma

- **Assets:** as 4 artes dos NFTs e o ícone "Thank you" foram exportados do Figma (convertidos para WebP/SVG). Os ícones de redes sociais são SVG inline, porque o lucide não tem marcas. A fonte é a Roboto Mono do Figma, self-hosted.
- **Login/cadastro:** diálogo sobre a home no desktop (como no Figma) e tela cheia no mobile. As abas "Entrar | Criar conta" são links (`/entrar`, `/cadastro`) para permitir acesso direto.
- **Pagamento:** o Figma mistura dados de perfil e carteira num formulário só. Mantive os campos, mas endereço e ENS secundário vêm da carteira cadastrada escolhida (somente leitura), e "Usar outra carteira?" alterna para a secundária. Foram adicionados "Conectar carteira" (com conexão simulada, recusa e desconexão) e um diálogo de **revisão** antes de enviar, exigidos pelo enunciado.
- **Perfil:** o Figma tem um único "Salvar". Separei "Salvar" (dados) e "Alterar senha" para validações e erros independentes.
- **Detalhe:** a galeria do Figma repete a mesma arte; as miniaturas mostram enquadramentos diferentes. "COMPRAR" adiciona ao carrinho e leva a ele; no mobile, o botão de carrinho só adiciona.
- **Fora do escopo** (Criadores, Aprenda, Atividade, Ofertas, Downloads, Suporte, newsletter, login social, "Esqueceu a senha", "Ler mais", scanner do mobile): continuam visíveis para preservar o layout, mas avisam que estão "em breve" (`aria-disabled`) e nunca simulam sucesso. Links externos (redes sociais, compartilhar, Etherscan) abrem em nova aba; a transação no Etherscan é simulada e isso é indicado no recibo.
- **Extras:** chips de filtros ativos, contagem de resultados, página `/favoritos` (alvo do coração na barra mobile e de "Lista de interesse") e painel de cenários para demonstração.
- **Mobile:** sem frames de perfil, carteiras e confirmação; essas telas seguem o mesmo sistema (barra superior com voltar e conteúdo em uma coluna).
