import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { isAuthenticated } from '@/session/session-store'

/** Pathless layout guarding private flows (checkout, orders, profile, wallets, favorites). */
export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ location }) => {
    if (!isAuthenticated()) {
      throw redirect({ to: '/entrar', search: { redirect: location.href } })
    }
  },
  component: Outlet,
})
