import { expect, open, test } from './fixtures'

const grid = (page: import('@playwright/test').Page) => page.locator('#catalogo article')

test.describe('Catálogo', () => {
  test('1. busca, filtros combinados, ordenação, paginação e restauração pelo histórico', async ({ page, isMobile }) => {
    test.skip(isMobile, 'filtros laterais são cobertos no desktop; mobile usa o mesmo estado de URL')
    await open(page, '/')
    await expect(grid(page)).toHaveCount(9)

    // pagination
    await page.getByRole('button', { name: 'Página 2', exact: true }).click()
    await expect(page).toHaveURL(/pagina=2/)
    await expect(page.getByRole('button', { name: 'Página 2', exact: true })).toHaveAttribute('aria-current', 'page')

    // combined filters reset pagination and compose the URL
    const filters = page.getByRole('complementary', { name: 'Filtros' })
    await filters.getByText('Música', { exact: true }).click()
    await expect(page).not.toHaveURL(/pagina=/)
    await expect(page).toHaveURL(/cat=musica/)
    await filters.getByText('Solana', { exact: true }).click()
    await expect(page).toHaveURL(/rede=solana/)
    await expect(grid(page).first()).toBeVisible()

    // sorting
    await page.getByRole('combobox', { name: 'Ordenar por:' }).selectOption({ label: 'Menor preço' })
    await expect(page).toHaveURL(/ordem=preco-asc/)
    await expect
      .poll(async () => {
        const values = (await grid(page).locator('p').allInnerTexts()).map((p) => Number(p.match(/([\d.]+) ETH/)![1]))
        return values.every((v, i) => i === 0 || values[i - 1]! <= v)
      })
      .toBe(true)

    // search via header
    await page.getByRole('button', { name: 'Buscar NFTs' }).click()
    await page.getByRole('searchbox', { name: 'Buscar NFTs' }).or(page.getByLabel('Buscar NFTs')).first().fill('emerald')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/q=emerald/)
    await expect(page.getByText('Busca: “emerald”')).toBeVisible()
    await expect
      .poll(async () => (await grid(page).locator('h3').allInnerTexts()).every((n) => n.toLowerCase().includes('emerald')))
      .toBe(true)

    // history restores previous states
    await page.goBack()
    await expect(page).not.toHaveURL(/q=emerald/)
    await expect(page).toHaveURL(/ordem=preco-asc/)
    await page.goForward()
    await expect(page).toHaveURL(/q=emerald/)

    // refresh keeps the URL state
    await page.reload()
    await expect(page.getByText('Busca: “emerald”')).toBeVisible()
    await expect(filters.getByRole('checkbox', { name: /Música/ })).toBeChecked()
  })

  test('resultado vazio e limpar filtros', async ({ page }) => {
    await open(page, '/?q=nao-existe-xyz')
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(grid(page)).toHaveCount(9)
  })

  test('respostas fora de ordem não sobrescrevem o filtro atual', async ({ page, isMobile }) => {
    test.skip(isMobile)
    await open(page, '/', 'fora-de-ordem')
    await expect(grid(page)).toHaveCount(9)
    const filters = page.getByRole('complementary', { name: 'Filtros' })
    // first request is slow, second fast → the slow (older) one must be discarded
    await filters.getByText('Fotografia', { exact: true }).click()
    await filters.getByText('Fotografia', { exact: true }).click()
    await filters.getByText('Jogos', { exact: true }).click()
    await expect(page).toHaveURL(/cat=jogos(#catalogo)?$/)
    await page.waitForTimeout(2000)
    await expect(page.getByRole('button', { name: 'Remover filtro Jogos' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remover filtro Fotografia' })).toHaveCount(0)
    const total = await page.getByText(/resultado\(s\)/).innerText()
    const response = await page.evaluate(() => fetch('/api/nfts?categories=jogos&pageSize=9').then((r) => r.json()))
    expect(total).toContain(String(response.total))
  })

  test('2. acesso direto ao detalhe e NFT inexistente', async ({ page }) => {
    await open(page, '/nft/ivory-baron-088')
    await expect(page.getByRole('heading', { level: 1, name: 'Ivory Baron #088' })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Edição 1\/50/ })).toHaveAttribute('aria-checked', 'true')

    await open(page, '/nft/nao-existe-123')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()

    await open(page, '/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('edição indisponível e limite de quantidade', async ({ page, isMobile }) => {
    await open(page, '/nft/golden-signal-160?edicao=aberta')
    await expect(page.getByText(/edição ABERTA está esgotada/)).toBeVisible()
    await expect(page.getByRole('button', { name: isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true })).toBeDisabled()

    await page.getByRole('radio', { name: /Edição 1\/1,/ }).click()
    await expect(page.getByText(/máximo 1 por pedido/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Aumentar quantidade/ }).first()).toBeDisabled()
  })

  test('12. skeletons em rede lenta, falha e recuperação após nova tentativa', async ({ page }) => {
    await page.goto('/?scenario=lento')
    await expect(page.locator('#catalogo [aria-hidden="true"] .shimmer').first()).toBeVisible()
    await expect(grid(page)).toHaveCount(9, { timeout: 15_000 })

    await page.goto('/?scenario=falha-transitoria')
    await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível carregar' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(grid(page)).toHaveCount(9)
  })

  test('timeout de leitura: feedback e recuperação', async ({ page, isMobile }) => {
    test.skip(isMobile)
    test.setTimeout(60_000)
    await page.goto('/?scenario=timeout-catalogo')
    // 1st attempt + 1 automatic retry time out (10 s each) → error with retry action
    await expect(page.getByRole('alert').filter({ hasText: 'O servidor demorou demais para responder.' })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.locator('#catalogo article')).toHaveCount(9)
  })

  test('sem conexão mostra feedback de rede', async ({ page }) => {
    await page.goto('/?scenario=offline')
    await expect(page.getByRole('alert').filter({ hasText: 'Sem conexão' })).toBeVisible({ timeout: 15_000 })
  })
})
