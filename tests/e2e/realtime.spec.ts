import { addToCart, expect, goToCheckoutAndConnect, login, openReview, test, USERS, waitForRealtime } from './fixtures'

test.describe('Tempo real (Socket.IO via MSW)', () => {
  test('9. preço alterado durante o checkout bloqueia cotação desatualizada', async ({ page, mock }) => {
    await addToCart(page, 'emerald-ape-042')
    // 1) item in cart, price changes while browsing the cart
    await mock.updateNft('emerald-ape-042', { edition: '1/50', editionPrice: '1.29' })
    await expect(page.getByTestId('price-notice')).toContainText('preço mudou de 1.19 ETH para 1.29 ETH')
    await expect(page.getByTestId('quote-total')).toHaveText('1.306 ETH')

    // 2) checkout: event during review makes the quote stale
    await login(page, USERS.ana)
    await goToCheckoutAndConnect(page)
    await openReview(page)
    await mock.updateNft('emerald-ape-042', { edition: '1/50', editionPrice: '1.49' })
    await expect(page.getByTestId('quote-stale')).toBeVisible()
    await expect(page.getByTestId('confirm-purchase')).toBeDisabled()
    await page.getByRole('button', { name: 'Atualizar cotação' }).click()
    await expect(page.getByTestId('quote-changed')).toContainText('1.506 ETH')
    await expect(page.getByTestId('confirm-purchase')).toBeEnabled()
  })

  test('detalhe e catálogo refletem disponibilidade em tempo real', async ({ page, mock }) => {
    await page.goto('/nft/ivory-baron-088')
    await waitForRealtime(page)
    await expect(page.getByText(/disponível\(is\)/)).toBeVisible()
    await mock.updateNft('ivory-baron-088', { edition: '1/50', available: 0 })
    await expect(page.getByText(/edição 1\/50 está esgotada/)).toBeVisible()
  })

  test('10a. eventos duplicados e antigos não regridem o estado', async ({ page, mock }) => {
    await addToCart(page, 'emerald-ape-042')
    await mock.scenario('eventos-duplicados')
    await mock.updateNft('emerald-ape-042', { edition: '1/50', editionPrice: '1.39' })
    await expect(page.getByTestId('price-notice')).toHaveCount(1)
    await expect(page.getByTestId('price-notice')).toContainText('para 1.39 ETH')
    await mock.updateNft('emerald-ape-042', { edition: '1/50', editionPrice: '1.59' })
    await expect(page.getByTestId('quote-total')).toHaveText('1.606 ETH')
    // the stale copy (older version) delivered after each event must not win
    await page.waitForTimeout(500)
    await expect(page.getByTestId('quote-total')).toHaveText('1.606 ETH')
  })

  test('10b. desconexão com pedido pendente e retomada após reconectar/recarregar', async ({ page, mock }) => {
    await addToCart(page, 'emerald-ape-042')
    await login(page, USERS.ana)
    await goToCheckoutAndConnect(page)
    await openReview(page)
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByRole('dialog', { name: 'Aguardando confirmação na rede' })).toBeVisible()

    // connection drops while pending → the order settles meanwhile
    await mock.scenario('offline')
    await expect(page.getByTestId('realtime-status')).toBeVisible()
    await page.waitForTimeout(3000)
    await mock.scenario('padrao')

    // reload: state is recovered from REST, no second purchase is created
    await page.reload()
    await expect(page).toHaveURL(/\/pedido\/ord_/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    const state = await mock.state()
    expect(state.orders).toHaveLength(1)
  })

  test('eventos de pedido de outro usuário são ignorados', async ({ page, mock }) => {
    await addToCart(page, 'emerald-ape-042')
    await login(page, USERS.ana)
    await goToCheckoutAndConnect(page)
    await openReview(page)
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByRole('dialog', { name: 'Aguardando confirmação na rede' })).toBeVisible()
    // switch user while Ana's order is pending: Bruno's session must not receive it
    // drop only Ana's client session (the mock DB also lives in localStorage)
    await page.evaluate(() => {
      localStorage.removeItem('kurio.session.v1')
      localStorage.removeItem('kurio.checkout.attempt.v1')
    })
    await login(page, USERS.bruno)
    await page.waitForTimeout(3500)
    const state = await mock.state()
    expect(state.orders[0]!.userId).toBe('u_ana')
    await page.goto(`/pedido/${state.orders[0]!.id}`)
    await expect(page.getByRole('heading', { name: 'Acesso negado' })).toBeVisible()
  })
})
