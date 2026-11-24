export interface AuthSearch {
  redirect?: string
  motivo?: 'expirada'
}

export const validateAuthSearch = (raw: Record<string, unknown>): AuthSearch => ({
  redirect: typeof raw.redirect === 'string' && raw.redirect.startsWith('/') ? raw.redirect : undefined,
  motivo: raw.motivo === 'expirada' ? 'expirada' : undefined,
})
