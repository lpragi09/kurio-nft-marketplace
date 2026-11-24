import path from 'node:path'
import { expect, login, open, test, USERS } from './fixtures'

test.describe('Perfil e carteiras', () => {
  test('8a. edição de perfil com erros de validação, conflito e persistência', async ({ page }) => {
    await login(page, USERS.ana)
    await open(page, '/perfil')
    const username = page.getByRole('textbox', { name: 'Nome de usuário' })
    await expect(username).toHaveValue('ana.colecionadora')

    await username.fill('Inválido!')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Use apenas letras minúsculas, números, ponto e sublinhado.')).toBeVisible()

    await username.fill('bruno.nft') // taken by another user → 409 from the API
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Este nome de usuário já está em uso.')).toBeVisible()

    await username.fill('ana.nova')
    await page.getByRole('textbox', { name: 'Nome de exibição' }).fill('Ana S.')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Perfil atualizado.')).toBeVisible()
    await page.reload()
    await expect(username).toHaveValue('ana.nova')
    await expect(page.getByRole('textbox', { name: 'Nome de exibição' })).toHaveValue('Ana S.')
  })

  test('8b. avatar e alteração de senha', async ({ page }) => {
    await login(page, USERS.ana)
    await open(page, '/perfil')
    await page.locator('#avatar-input').setInputFiles(path.join(import.meta.dirname, 'assets', 'avatar.png'))
    await expect(page.getByText('Avatar atualizado.')).toBeVisible()
    await expect(page.getByRole('img', { name: /Avatar atual de/ })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('img', { name: /Avatar atual de/ })).toBeVisible()

    await page.getByLabel('Senha atual', { exact: true }).fill('errada000')
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha1')
    await page.getByLabel('Confirmar nova senha', { exact: true }).fill('NovaSenha2')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('As senhas não coincidem.')).toBeVisible()
    await page.getByLabel('Confirmar nova senha', { exact: true }).fill('NovaSenha1')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('Senha atual incorreta.').first()).toBeVisible()
    await page.getByLabel('Senha atual', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('Senha alterada com sucesso.')).toBeVisible()

    // the new password works after logout
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByText('Você saiu da sua conta.')).toBeVisible()
    await expect(page).toHaveURL('/')
    await login(page, { ...USERS.ana, password: 'NovaSenha1' })
  })

  test('8c. cadastro e edição de carteiras principal e secundária', async ({ page }) => {
    await login(page, USERS.bruno)
    await open(page, '/perfil/carteiras')
    await expect(page.getByText('Cadastre a carteira principal antes da secundária.')).toBeVisible()
    const form = page.getByRole('form', { name: 'Carteira principal' })
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form.getByText('Selecione uma rede.')).toBeVisible()
    await expect(form.getByText('Endereço deve começar com 0x e ter 40 caracteres hexadecimais.')).toBeVisible()

    await form.getByRole('textbox', { name: 'Apelido da carteira' }).fill('Principal do Bruno')
    await form.getByRole('textbox', { name: 'Nome do perfil' }).fill('bruno.kurio')
    await form.getByRole('combobox', { name: 'Rede' }).click()
    await page.getByRole('option', { name: 'Polygon' }).click()
    await form.getByRole('textbox', { name: 'Endereço da carteira' }).fill('0x1111111111111111111111111111111111111111')
    await form.getByRole('combobox', { name: 'Tipo de carteira' }).click()
    await page.getByRole('option', { name: 'MetaMask' }).click()
    await form.getByRole('textbox', { name: 'Código de indicação' }).fill('BRUNO-1')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira cadastrada.')).toBeVisible()

    // secondary, copying the primary data (address must differ → API conflict first)
    await page.getByRole('checkbox', { name: 'Igual à carteira principal' }).check()
    await page.getByRole('button', { name: 'Adicionar' }).click()
    const second = page.getByRole('form', { name: 'Carteira secundária' })
    await second.getByRole('textbox', { name: 'Endereço da carteira' }).fill('0x1111111111111111111111111111111111111111')
    await second.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(second.getByText('Este endereço já está cadastrado.')).toBeVisible()
    await second.getByRole('textbox', { name: 'Endereço da carteira' }).fill('0x2222222222222222222222222222222222222222')
    await second.getByRole('button', { name: 'Salvar carteira' }).click()
    // once saved, the "Adicionar" action disappears (the secondary slot is taken)
    await expect(page.getByRole('button', { name: 'Cancelar' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Adicionar' })).toHaveCount(0)

    // edit + persistence
    await page.reload()
    const editPrimary = page.getByRole('form', { name: 'Carteira principal' })
    await editPrimary.getByRole('textbox', { name: 'Apelido da carteira' }).fill('Cofre')
    await editPrimary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira atualizada.')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('form', { name: 'Carteira principal' }).getByRole('textbox', { name: 'Apelido da carteira' })).toHaveValue('Cofre')
    await expect(page.getByRole('form', { name: 'Carteira secundária' }).getByRole('textbox', { name: 'Endereço da carteira' })).toHaveValue('0x2222222222222222222222222222222222222222')
  })
})
