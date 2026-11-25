export interface AuthSearch {
  redirect?: string
  motivo?: 'expirada'
}

export const validateAuthSearch = (raw: Record<string, unknown>): AuthSearch => ({
  redirect: typeof raw.redirect === 'string' && raw.redirect.startsWith('/') ? raw.redirect : undefined,
  motivo: raw.motivo === 'expirada' ? 'expirada' : undefined,
})

/** Only same-origin paths are accepted as post-login destinations (no open redirects). */
export function safeRedirect(redirect?: string) {
  return redirect && redirect.startsWith('/') && !redirect.startsWith('//') && !/^\/(entrar|cadastro)/.test(redirect) ? redirect : '/'
}
