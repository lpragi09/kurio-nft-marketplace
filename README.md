# Kurio — Marketplace de NFTs (Desafio Frontend Jungle Gaming)

Implementação do [desafio](https://github.com/junglegaming/frontend-challenge) seguindo o layout do Figma: descoberta, compra e conta do colecionador, em desktop e mobile, com API REST e Socket.IO **simulados com MSW**.

> Arquitetura, contratos REST/eventos, política de sessão, cache e desvios do Figma: **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

## Stack

React 19 · TypeScript · Vite · TanStack Router (rotas por arquivo) · TanStack Query · Axios · Socket.IO client · Tailwind CSS v4 · shadcn/ui (Radix) · MSW 2 + `@mswjs/socket.io-binding` · React Hook Form + Zod · big.js · Playwright · Lighthouse.

## Setup

Requer Node ≥ 20.19 (testado em Node 24).

```bash
npm ci
npx playwright install chromium   # apenas para os testes E2E
npm run dev                       # http://localhost:5173 (com mocks)
```

Nada depende de serviços externos: o backend inteiro (REST + tempo real) roda no navegador via MSW.

## Variáveis de ambiente

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Liga o servidor simulado (MSW: REST + Socket.IO). Fica ativo também no build de demonstração/deploy. `false` desliga (a app passa a chamar `/api` real). |

Copie `.env.example` para `.env` se quiser alterar.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks |
| `npm run build` | Verificação de tipos + build otimizado (`dist/`) |
| `npm run preview` | Serve o build em http://localhost:4173 |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | oxlint em `src` e `tests` |
| `npm run test:e2e` | Playwright (builda e sobe o preview automaticamente), Chromium desktop 1440×900 e mobile 390×844 |
| `npm run test:e2e:update` | Regera as baselines de regressão visual |
| `npm run test:e2e:report` | Abre o relatório HTML (`playwright-report/`), com traces das falhas |
| `npm run lighthouse` | Audita início e detalhe, mobile + desktop, 3 execuções cada (rodar após `npm run build`) |

## Credenciais fictícias

| Usuário | E-mail | Senha | Observação |
| --- | --- | --- | --- |
| Ana Souza | `ana@kurio.test` | `Kurio@123` | 2 carteiras (principal e reserva), 2 favoritos |
| Bruno Lima | `bruno@kurio.test` | `Kurio@123` | sem carteiras, sem favoritos |

Cupons: `KURIO10` (10%), `GENESIS20` (20%), `VERAO24` (expirado). Qualquer outro código é inválido.

As senhas são guardadas no mock apenas como hash SHA-256 com salt; o cliente nunca persiste senhas.

## Cenários do mock (seleção e reset)

Três formas de escolher o cenário (todos determinísticos e persistidos até serem trocados):

1. **URL:** `?scenario=<nome>` em qualquer rota (ex.: `/?scenario=lento`). `?mockReset=1` restaura o banco simulado ao snapshot das fixtures.
2. **Painel "Cenários"** (botão flutuante no canto inferior esquerdo): troca de cenário, ações (subir preço do 1º item do carrinho, reduzir estoque, derrubar o Socket.IO, expirar a sessão) e **Resetar dados e cenário**.
3. **Rotas de controle** (usadas pelo Playwright): `GET /__mock/state`, `POST /__mock/reset`, `POST /__mock/scenario {name}`, `POST /__mock/nfts/:id {price | edition+editionPrice | edition+available}`, `POST /__mock/sockets/drop`, `POST /__mock/sessions/expire`, `POST /__mock/orders/:id/settle`.

Todas as ações passam pelo MSW: alteram o banco simulado, que responde via REST e emite os eventos Socket.IO correspondentes. Nada é injetado direto no cache da UI.

| Cenário | Efeito |
| --- | --- |
| `padrao` | Sucesso, latência fixa de 120 ms |
| `lento` | Todas as respostas levam 2,5 s (skeletons) |
| `latencia-variavel` | 200 ms–1,8 s, pseudoaleatório com seed fixa |
| `fora-de-ordem` | Requisições alternam 1,5 s / 150 ms (respostas fora de ordem) |
| `offline` | Toda requisição falha na rede; o socket é recusado |
| `erro-servidor` | Catálogo e detalhe respondem 500 |
| `falha-transitoria` | As 2 primeiras chamadas do catálogo respondem 503; a nova tentativa funciona |
| `catalogo-vazio` | Busca sem resultados |
| `favoritos-falha` | Favoritar/desfavoritar responde 500 (rollback otimista) |
| `sessao-curta` | Tokens expiram 45 s após o login |
| `acesso-negado` | Rotas de perfil respondem 403 |
| `preco-alterado` | Ao confirmar a compra, o preço do 1º item sobe e a API exige nova confirmação |
| `edicao-esgotada` | Ao confirmar, a edição do 1º item esgota (409) |
| `pedido-timeout` | O 1º envio cria o pedido mas nunca responde; o reenvio com a mesma chave recupera o mesmo pedido |
| `pagamento-recusado` | O pedido fica pendente e depois é recusado |
| `carteira-recusada` | A conexão simulada da carteira é recusada |
| `eventos-duplicados` | Cada evento Socket.IO chega duas vezes, seguido de uma versão antiga |

### Reproduzindo os fluxos de falha

- **Preço muda com o item no carrinho:** adicione um NFT → `/carrinho` → painel → "Subir preço do 1º item do carrinho". Aparece um aviso acessível e o resumo é recalculado.
- **Checkout com cotação desatualizada:** com a revisão do pedido aberta, use o mesmo botão do painel. A confirmação fica bloqueada até "Atualizar cotação".
- **Timeout com recuperação:** `/pagamento?scenario=pedido-timeout` → confirmar. Após 6 s o cliente reenvia com a mesma `Idempotency-Key` e recebe o mesmo pedido (`/__mock/state` mostra um único pedido).
- **Desconexão com pedido pendente:** confirme uma compra e, durante "Aguardando confirmação", troque para `offline` no painel e depois volte para `padrao`, ou recarregue a página. O estado é recuperado via REST, sem nova compra.
- **Sessão expirada no checkout:** painel → "Expirar sessão". Você volta ao login com `redirect`, e o rascunho do formulário e o carrinho são preservados.
- **Pagamento recusado:** `/pagamento?scenario=pagamento-recusado`.

## Testes

`tests/e2e/` cobre os 12 fluxos pedidos (busca/filtros/paginação/histórico, detalhe/404, cadastro/login/expiração/logout/troca de usuário, favoritos com rollback, carrinho/cupom/persistência/merge, compra completa, recusa/clique repetido/timeout idempotente, perfil/avatar/senha/carteiras, preço via Socket.IO no checkout, eventos duplicados/antigos e retomada de pedido pendente, teclado/foco/validação, skeletons/falha/nova tentativa), além da regressão visual de início, detalhe, carrinho e pagamento.

- Última execução local: **69 passaram, 3 pulados de propósito** (navegação por teclado e filtros laterais rodam só no desktop), em Chromium desktop e mobile.
- Cada teste roda num contexto novo (localStorage vazio → banco simulado re-semeado), o que garante isolamento.
- Latência e falhas são controladas por cenário; eventos são disparados pelas rotas `/__mock/*`, passando pelo `socket.io-client` real. Os testes visuais fixam o relógio (`page.clock.setFixedTime`).
- Baselines versionadas em `tests/e2e/__screenshots__/{desktop,mobile}/` (geradas no Windows; em outro SO, rode `npm run test:e2e:update` uma vez, porque a renderização de fonte varia).
- Relatório HTML em `playwright-report/`, com traces das falhas (`trace: retain-on-failure`).

## Lighthouse

`scripts/lighthouse.mjs` (configuração versionada) sobe o `vite preview` e audita `/` e `/nft/emerald-ape-042` nos perfis mobile e desktop, 3 vezes cada, no cenário padrão dos mocks. Os relatórios HTML/JSON por execução e o `summary.md`/`summary.json` (medianas, LCP/CLS/TBT, versões e ambiente) ficam em `lighthouse/reports/`.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| início | mobile | 69 | 100 | 100 | 100 | 5394 ms | 0.001 | 307 ms |
| início | desktop | 99 | 100 | 100 | 100 | 980 ms | 0.002 | 15 ms |
| detalhe | mobile | 78 | 100 | 100 | 100 | 4785 ms | 0.029 | 257 ms |
| detalhe | desktop | 98 | 100 | 100 | 100 | 1109 ms | 0.006 | 0 ms |

Mediana de 3 execuções (Lighthouse 13.6.0, Chrome headless 158, Node 24, Windows 11, Ryzen 5 5600X; throttling padrão do Lighthouse). A justificativa da performance mobile abaixo da meta está em [ARCHITECTURE.md § Performance](./ARCHITECTURE.md#performance-e-lighthouse).

## Deploy

Vercel (`vercel.json`): SPA com rewrite para `index.html` (acesso direto e refresh em qualquer rota), cache imutável para `/assets`, `mockServiceWorker.js` sem cache. O build publicado inclui os mocks e o tempo real.
