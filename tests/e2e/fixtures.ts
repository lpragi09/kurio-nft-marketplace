import { test as base, expect, type Page } from '@playwright/test'

export const USERS = {
  ana: { email: 'ana@kurio.test', password: 'Kurio@123', name: 'Ana Souza' },
  bruno: { email: 'bruno@kurio.test', password: 'Kurio@123', name: 'Bruno Lima' },
} as const

/** Talks to the MSW control routes (/__mock/*) from inside the page. */
export class MockControl {
  constructor(private page: Page) {}

  private async call<T>(path: string, body?: unknown): Promise<T> {
    return this.page.evaluate(
      async ({ path, body }) => {
        const res = await fetch(`/__mock${path}`, {
          method: body === undefined ? 'GET' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
        return res.json()
      },
      { path, body },
    ) as Promise<T>
  }

  scenario(name: string) {
    return this.call('/scenario', { name })
  }
  updateNft(id: string, patch: { edition?: string; editionPrice?: string; available?: number; price?: string }) {
    return this.call(`/nfts/${id}`, patch)
  }
  dropSockets() {
    return this.call('/sockets/drop', {})
  }
  expireSessions() {
    return this.call('/sessions/expire', {})
  }
  state() {
    return this.call<{ sockets: number; orders: { id: string; status: string; userId: string }[]; scenario: { name: string } }>('/state')
  }
}

export const test = base.extend<{ mock: MockControl; isMobile: boolean }>({
  // Playwright passes the fixture setter positionally; it is named `provide` (not `use`)
  // so React-hooks lint rules do not mistake it for a hook.
  mock: async ({ page }, provide) => {
    await provide(new MockControl(page))
  },
  // oxlint-disable-next-line no-empty-pattern -- Playwright requires a destructuring pattern here
  isMobile: async ({}, provide, info) => {
    await provide(info.project.name === 'mobile')
  },
})

export { expect }

/** Opens a route with an optional scenario (applied before the app boots). */
export async function open(page: Page, path = '/', scenario?: string) {
  const sep = path.includes('?') ? '&' : '?'
  await page.goto(scenario ? `${path}${sep}scenario=${scenario}` : path)
  await waitForRealtime(page)
}

export async function waitForRealtime(page: Page) {
  await page.waitForFunction(() => (window as unknown as { __kurioRealtime?: { connected: boolean } }).__kurioRealtime?.connected === true, null, {
    timeout: 10_000,
  })
}

export async function login(page: Page, user: (typeof USERS)[keyof typeof USERS] = USERS.ana, redirect?: string) {
  await page.goto(redirect ? `/entrar?redirect=${encodeURIComponent(redirect)}` : '/entrar')
  await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(user.email)
  await page.getByLabel('Senha', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  // session persisted for the expected user (independent of the toast)
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kurio.session.v1') ?? 'null')?.user?.email ?? null))
    .toBe(user.email)
  await expect(page).not.toHaveURL(/\/entrar/)
  await waitForRealtime(page)
}

export async function addToCart(page: Page, nftId: string, opts: { quantity?: number; edition?: string } = {}) {
  await page.goto(`/nft/${nftId}${opts.edition ? `?edicao=${encodeURIComponent(opts.edition)}` : ''}`)
  await waitForRealtime(page)
  const mobile = page.viewportSize()!.width < 768
  const name = await page.getByRole('heading', { level: 1 }).innerText()
  for (let i = 1; i < (opts.quantity ?? 1); i++) {
    await page.getByRole('button', { name: `Aumentar quantidade de ${name}` }).first().click()
  }
  await page.getByRole('button', { name: mobile ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
  await expect(page).toHaveURL(/\/carrinho$/)
}

export async function goToCheckoutAndConnect(page: Page) {
  await page.goto('/pagamento')
  await waitForRealtime(page)
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByTestId('wallet-connected')).toBeVisible()
}

export async function openReview(page: Page) {
  await page.getByRole('button', { name: 'Revisar e confirmar compra' }).click()
  await expect(page.getByRole('dialog', { name: 'Revise seu pedido' })).toBeVisible()
}
