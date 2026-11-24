import { addToCart, expect, goToCheckoutAndConnect, login, open, openReview, test, USERS } from './fixtures'

test.describe('Compra', () => {
  test('6. compra completa: catálogo → detalhe → carrinho → pagamento → recibo', async ({ page, mock }) => {
    await open(page, '/')
    await page.getByRole('link', { name: 'Golden Beat #207' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Golden Beat #207' })).toBeVisible()
    await page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ }).click()
    await expect(page).toHaveURL(/\/carrinho$/)
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento/)
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/pagamento$/)
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // validation before review
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('email-invalido')
    await page.getByRole('button', { name: 'Revisar e confirmar compra' }).click()
    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('ana@kurio.test')
    await page.getByRole('button', { name: 'Revisar e confirmar compra' }).click()
    await expect(page.getByText('Conecte a carteira antes de revisar o pedido.')).toBeVisible()

    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByTestId('wallet-connected')).toBeVisible()
    await openReview(page)
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByRole('dialog', { name: 'Aguardando confirmação na rede' })).toBeVisible()
    await expect(page).toHaveURL(/\/pedido\/ord_/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    await expect(page.getByTestId('receipt-total')).toHaveText('1.006 ETH') // 0.99 + 0.016

    // receipt is a snapshot: later catalog changes do not alter it
    await mock.updateNft('golden-beat-207', { price: '5.00' })
    await page.reload()
    await expect(page.getByTestId('receipt-total')).toHaveText('1.006 ETH')

    // purchased items were removed from the cart
    await page.goto('/carrinho')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })

  test('7a. pagamento recusado preserva o carrinho', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')
    await login(page, USERS.ana)
    await open(page, '/pagamento', 'pagamento-recusado')
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByTestId('wallet-connected')).toBeVisible()
    await openReview(page)
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page.getByText('Emerald Ape #042').filter({ visible: true }).first()).toBeVisible()
  })

  test('7b. clique repetido cria um único pedido', async ({ page, mock }) => {
    await addToCart(page, 'emerald-ape-042')
    await login(page, USERS.ana)
    await goToCheckoutAndConnect(page)
    await openReview(page)
    const confirm = page.getByTestId('confirm-purchase')
    await confirm.dblclick({ force: true })
    await confirm.click({ force: true }).catch(() => {})
    await expect(page).toHaveURL(/\/pedido\/ord_/, { timeout: 15_000 })
    const state = await mock.state()
    expect(state.orders).toHaveLength(1)
  })

  test('7c. timeout após criar o pedido recupera o mesmo pedido por idempotência', async ({ page, mock }) => {
    await addToCart(page, 'emerald-ape-042')
    await login(page, USERS.ana)
    await open(page, '/pagamento', 'pedido-timeout')
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByTestId('wallet-connected')).toBeVisible()
    await openReview(page)
    await page.getByTestId('confirm-purchase').click()
    await expect(page).toHaveURL(/\/pedido\/ord_/, { timeout: 20_000 })
    const state = await mock.state()
    expect(state.orders).toHaveLength(1)
    expect(state.orders[0]!.status).toBe('confirmed')
  })

  test('preço alterado durante a compra exige nova confirmação', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')
    await login(page, USERS.ana)
    await open(page, '/pagamento', 'preco-alterado')
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByTestId('wallet-connected')).toBeVisible()
    await openReview(page)
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('quote-changed')).toContainText('1.256 ETH') // 1.24 + 0.016
    await page.getByTestId('confirm-purchase').click()
    await expect(page).toHaveURL(/\/pedido\/ord_/, { timeout: 15_000 })
  })

  test('edição esgotada durante a compra bloqueia a confirmação', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')
    await login(page, USERS.ana)
    await open(page, '/pagamento', 'edicao-esgotada')
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByTestId('wallet-connected')).toBeVisible()
    await openReview(page)
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByRole('dialog').getByText(/não tem mais 1 unidade/)).toBeVisible()
    await expect(page.getByTestId('confirm-purchase')).toBeDisabled()
  })

  test('carteira recusa e desconexão', async ({ page, mock }) => {
    await addToCart(page, 'emerald-ape-042')
    await login(page, USERS.ana)
    await open(page, '/pagamento', 'carteira-recusada')
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByText(/A carteira recusou a solicitação de conexão/)).toBeVisible()
    await mock.scenario('padrao')
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByTestId('wallet-connected')).toBeVisible()
    await page.getByRole('button', { name: 'Desconectar' }).click()
    await expect(page.getByRole('button', { name: 'Conectar carteira' })).toBeVisible()
  })
})
