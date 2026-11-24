import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthScreen, safeRedirect } from '@/features/auth/auth-screen'
import { validateAuthSearch } from '@/features/auth/auth-search'
import { isAuthenticated } from '@/session/session-store'

export const Route = createFileRoute('/entrar')({
  validateSearch: validateAuthSearch,
  beforeLoad: ({ search }) => {
    if (isAuthenticated()) throw redirect({ href: safeRedirect(search.redirect) })
  },
  component: function Entrar() {
    const { redirect: to, motivo } = Route.useSearch()
    return <AuthScreen mode="login" redirect={to} reason={motivo} />
  },
})
