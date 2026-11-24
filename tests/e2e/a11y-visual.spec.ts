import { addToCart, expect, goToCheckoutAndConnect, login, open, test, USERS, waitForRealtime } from './fixtures'

test.describe('Acessibilidade', () => {
  test('11. navegação por teclado, foco em diálogo e validação de formulário', async ({ page, isMobile }) => {
    test.skip(isMobile, 'navegação por teclado validada no desktop')
    await open(page, '/')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Kurio, página inicial' })).toBeFocused()

    // dialog traps focus and returns it on close
    await page.goto('/nft/emerald-ape-042')
    await waitForRealtime(page)
    const zoom = page.getByRole('button', { name: 'Ampliar imagem' })
    await zoom.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(zoom).toBeFocused()

    // edition radios & stepper operable by keyboard
    await page.getByRole('radio', { name: /Edição 1\/10/ }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/edicao=1%2F10|edicao=1\/10/)

    // login dialog: focus inside, errors associated with inputs
    await page.goto('/entrar')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Entrar', exact: true }).focus()
    await page.keyboard.press('Enter')
    const email = page.getByRole('textbox', { name: 'E-mail', exact: true })
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toBeFocused()
    const describedBy = await email.getAttribute('aria-describedby')
    await expect(page.locator(`#${describedBy}`)).toHaveText('E-mail é obrigatório.')
  })

  test('sem overflow horizontal nas telas principais', async ({ page }) => {
    for (const path of ['/', '/nft/emerald-ape-042', '/carrinho', '/entrar']) {
      await open(page, path)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, path).toBeLessThanOrEqual(0)
    }
  })
})

test.describe('Regressão visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-24T12:00:00-03:00'))
  })

  const hideDynamic = (page: import('@playwright/test').Page) => [page.getByRole('button', { name: 'Cenários' }), page.locator('[data-sonner-toaster]')]

  test('início', async ({ page }) => {
    await open(page, '/')
    await expect(page.locator('#catalogo article')).toHaveCount(9)
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot('inicio.png', { mask: hideDynamic(page) })
  })

  test('detalhe', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot('detalhe.png', { mask: hideDynamic(page) })
  })

  test('carrinho', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042', { quantity: 2 })
    await addToCart(page, 'sage-nomad-009')
    await expect(page.getByTestId('quote-total')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot('carrinho.png', { mask: hideDynamic(page) })
  })

  test('pagamento', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')
    await login(page, USERS.ana)
    await goToCheckoutAndConnect(page)
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot('pagamento.png', { mask: hideDynamic(page) })
  })
})
