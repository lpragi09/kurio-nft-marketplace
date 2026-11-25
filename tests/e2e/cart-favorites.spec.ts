import { addToCart, expect, login, open, test, USERS } from './fixtures'

test.describe('Favoritos', () => {
  test('4. favoritar com atualização otimista, falha com rollback e recuperação', async ({ page, mock }) => {
    await login(page, USERS.bruno)
    await open(page, '/nft/sage-nomad-009')
    const fav = page.getByRole('button', { name: /^Favoritar$/ }).last()
    await fav.click()
    await expect(page.getByText('Sage Nomad #009 adicionado aos favoritos.')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: /Favoritado|Remover dos favoritos/ }).first()).toBeVisible()

    // failure → optimistic state rolls back
    await mock.scenario('favoritos-falha')
    await page.getByRole('button', { name: /Favoritado|Remover dos favoritos/ }).last().click()
    await expect(page.getByText(/Não foi possível remover dos favoritos Sage Nomad #009/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Favoritado|Remover dos favoritos/ }).first()).toBeVisible()

    // recovery
    await mock.scenario('padrao')
    await page.getByRole('button', { name: /Favoritado|Remover dos favoritos/ }).last().click()
    await expect(page.getByText('Sage Nomad #009 removido dos favoritos.')).toBeVisible()
  })

  test('visitante é enviado ao login ao favoritar', async ({ page }) => {
    await open(page, '/nft/sage-nomad-009')
    await page.getByRole('button', { name: /^Favoritar$/ }).last().click()
    await expect(page).toHaveURL(/\/entrar\?redirect=/)
  })
})

test.describe('Carrinho', () => {
  test('5. quantidades, remoção, cupom e persistência após refresh e login', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042', { quantity: 2 })
    await addToCart(page, 'ivory-baron-088')
    const total = page.getByTestId('quote-total')
    await expect(total).toHaveText('4.186 ETH') // 2×1.19 + 1.79 + 0.016

    // quantity
    await page.getByRole('button', { name: 'Aumentar quantidade de Ivory Baron #088' }).first().click()
    await expect(total).toHaveText('5.976 ETH')

    // coupon: invalid, expired, valid, removal
    const coupon = page.getByRole('textbox', { name: 'Código promocional' })
    await coupon.fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Cupom inválido.')).toBeVisible()
    await coupon.fill('VERAO24')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Este cupom expirou.')).toBeVisible()
    await coupon.fill('KURIO10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Desconto (KURIO10, 10%)')).toBeVisible()
    await expect(total).toHaveText('5.38 ETH') // 5.96 - 0.596 + 0.016

    // removal
    await page.getByRole('button', { name: 'Remover Emerald Ape #042 do carrinho' }).first().click()
    await expect(page.getByText('Emerald Ape #042 removido do carrinho.')).toBeVisible()

    // refresh keeps the guest cart
    await page.reload()
    await expect(page.getByText('Ivory Baron #088').filter({ visible: true }).first()).toBeVisible()

    // login merges the visitor cart into the user cart
    await login(page, USERS.bruno, '/carrinho')
    await expect(page).toHaveURL(/\/carrinho$/)
    await expect(page.getByText('Ivory Baron #088').filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Carrinho, 2 itens/ }).first()).toBeAttached()
  })

  test('limite de disponibilidade ao adicionar', async ({ page, mock, isMobile }) => {
    await open(page, '/nft/emerald-ape-042')
    await expect(page.getByText(/disponível\(is\)/)).toBeVisible()
    await mock.updateNft('emerald-ape-042', { edition: '1/50', available: 1 })
    await expect(page.getByText(/^1 disponível\(is\)/)).toBeVisible()
    await page.getByRole('button', { name: isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
    await expect(page).toHaveURL(/\/carrinho$/)
    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByText(/Você já tem o máximo permitido/)).toBeVisible()
  })
})
