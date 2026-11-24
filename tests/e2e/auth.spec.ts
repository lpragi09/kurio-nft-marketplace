import { addToCart, expect, login, open, test, USERS, waitForRealtime } from './fixtures'

test.describe('Conta e sessão', () => {
  test('3a. cadastro com validação e conflito, depois login', async ({ page }) => {
    await open(page, '/cadastro')
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
    await expect(page.getByText('O nome de usuário precisa de pelo menos 3 caracteres.')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Nome de usuário' })).toHaveAttribute('aria-invalid', 'true')

    // conflict returned by the API (409) is mapped to the field
    await page.getByRole('textbox', { name: 'Nome de usuário' }).fill('nova.pessoa')
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill('Segura123')
    await page.getByLabel('Confirmar senha', { exact: true }).fill('Segura124')
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
    await expect(page.getByText('As senhas não coincidem.')).toBeVisible()
    await page.getByLabel('Confirmar senha', { exact: true }).fill('Segura123')
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
    await expect(page.getByText('Este e-mail já está cadastrado.')).toBeVisible()

    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('nova@kurio.test')
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
    await expect(page.getByText('Conta criada! Bem-vindo à Kurio.')).toBeVisible()
    await expect(page).toHaveURL('/')

    // session survives a refresh
    await page.reload()
    await waitForRealtime(page)
    await page.goto('/perfil')
    await expect(page.getByRole('textbox', { name: 'Nome de usuário' })).toHaveValue('nova.pessoa')
  })

  test('3b. login inválido, redirecionamento e retorno ao fluxo', async ({ page }) => {
    await open(page, '/perfil/carteiras')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fperfil%2Fcarteiras/)
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill('errada123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
    await page.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/perfil\/carteiras$/)
  })

  test('3c. expiração de sessão no checkout preserva o contexto', async ({ page, mock, isMobile }) => {
    await addToCart(page, 'emerald-ape-042')
    await login(page, USERS.ana, '/pagamento')
    await expect(page).toHaveURL(/\/pagamento$/)
    await page.getByRole('textbox', { name: 'Código de indicação' }).fill('MEU-CODIGO')
    await mock.expireSessions()
    // the next request (ours, or a background refetch) gets 401 SESSION_EXPIRED
    await page.getByRole('button', { name: 'Conectar carteira' }).click({ timeout: 3000 }).catch(() => {})
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento&motivo=expirada/)
    await expect(page.getByText('Sua sessão expirou. Entre novamente para retomar de onde parou.')).toBeVisible()
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/pagamento$/)
    // the draft and the cart were preserved
    await expect(page.getByRole('textbox', { name: 'Código de indicação' })).toHaveValue('MEU-CODIGO')
    // cart preserved: the quote is computed again (item list only shown on desktop, as in the Figma)
    await expect(page.getByRole('button', { name: 'Revisar e confirmar compra' })).toBeEnabled()
    if (!isMobile) await expect(page.getByText('Emerald Ape #042').filter({ visible: true }).first()).toBeVisible()
  })

  test('3d. logout e troca de usuário limpam dados privados', async ({ page }) => {
    await login(page, USERS.ana)
    await page.goto('/favoritos')
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()

    await page.goto('/perfil')
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByText('Você saiu da sua conta.')).toBeVisible()
    await expect(page).toHaveURL('/')
    await page.goto('/favoritos')
    await expect(page).toHaveURL(/\/entrar/)

    await login(page, USERS.bruno)
    await page.goto('/favoritos')
    await expect(page.getByRole('heading', { name: 'Nenhum favorito ainda' })).toBeVisible()
    await expect(page.getByText('Emerald Ape #042')).toHaveCount(0)
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kurio.session.v1') ?? '{}').user?.email)
    expect(stored).toBe(USERS.bruno.email)
  })
})
