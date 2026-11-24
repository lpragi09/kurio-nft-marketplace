import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthScreen, safeRedirect } from '@/features/auth/auth-screen'
import { isAuthenticated } from '@/session/session-store'
import { validateAuthSearch } from '@/features/auth/auth-search'

export const Route = createFileRoute('/cadastro')({
  validateSearch: validateAuthSearch,
  beforeLoad: ({ search }) => {
    if (isAuthenticated()) throw redirect({ href: safeRedirect(search.redirect) })
  },
  component: function Cadastro() {
    const { redirect: to } = Route.useSearch()
    return <AuthScreen mode="register" redirect={to} />
  },
})
