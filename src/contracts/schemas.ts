import { z } from 'zod'

/** Validation rules shared by the forms (client) and the MSW handlers (server). */

const required = (label: string) => `${label} é obrigatório.`

export const emailSchema = z.string().trim().min(1, required('E-mail')).email('Informe um e-mail válido.')
export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'O nome de usuário precisa de pelo menos 3 caracteres.')
  .max(30, 'Máximo de 30 caracteres.')
  .regex(/^[a-z0-9._]+$/, 'Use apenas letras minúsculas, números, ponto e sublinhado.')
export const passwordSchema = z
  .string()
  .min(8, 'A senha precisa de pelo menos 8 caracteres.')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra.')
  .regex(/\d/, 'Inclua ao menos um número.')
export const ensNameSchema = z
  .string()
  .trim()
  .min(1, required('Nome ENS'))
  .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*$/, 'Use letras minúsculas, números, hífen e ponto (sem ".eth").')
export const addressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Endereço deve começar com 0x e ter 40 caracteres hexadecimais.')
export const networkSchema = z.enum(['ethereum', 'polygon', 'solana'], { message: 'Selecione uma rede.' })
export const providerSchema = z.enum(['metamask', 'walletconnect', 'coinbase'], { message: 'Selecione uma carteira.' })

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, required('Senha')),
})

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
})

export const registerFormSchema = registerSchema
  .extend({ confirmPassword: z.string().min(1, 'Confirme a senha.') })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não coincidem.' })

export const profileSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe ao menos 2 caracteres.').max(40, 'Máximo de 40 caracteres.'),
  username: usernameSchema,
  email: emailSchema,
  ensName: ensNameSchema,
  walletNickname: z.string().trim().min(2, 'Informe ao menos 2 caracteres.').max(30, 'Máximo de 30 caracteres.'),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, required('Senha atual')),
  newPassword: passwordSchema,
})

export const changePasswordFormSchema = changePasswordSchema
  .extend({ confirmPassword: z.string().min(1, 'Confirme a nova senha.') })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não coincidem.' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'A nova senha deve ser diferente da atual.' })

const optionalSecondary = z
  .string()
  .trim()
  .refine((v) => v === '' || /^0x[a-fA-F0-9]{40}$/.test(v) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/.test(v), 'Informe um endereço 0x ou um nome ENS terminado em .eth.')

export const walletSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe ao menos 2 caracteres.'),
  nickname: z.string().trim().min(2, 'Informe ao menos 2 caracteres.'),
  profileName: z.string().trim().min(2, 'Informe ao menos 2 caracteres.'),
  network: networkSchema,
  address: addressSchema,
  secondaryAddress: optionalSecondary,
  provider: providerSchema,
  referralCode: z.string().trim().min(3, 'Código de indicação deve ter ao menos 3 caracteres.').max(20, 'Máximo de 20 caracteres.'),
  email: emailSchema,
  ensName: ensNameSchema,
})

export const buyerSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe ao menos 2 caracteres.'),
  username: usernameSchema,
  profileName: z.string().trim().min(2, 'Informe ao menos 2 caracteres.'),
  email: emailSchema,
  ensName: ensNameSchema,
  referralCode: z.string().trim().min(3, 'Código de indicação deve ter ao menos 3 caracteres.'),
  note: z.string().max(280, 'Máximo de 280 caracteres.').optional(),
})

/** Converts a zod error into the API's `fields` map. */
export function zodFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (!fields[key]) fields[key] = issue.message
  }
  return fields
}
