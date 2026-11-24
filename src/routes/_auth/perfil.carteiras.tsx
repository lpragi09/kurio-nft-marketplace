import { createFileRoute } from '@tanstack/react-router'
import { WalletsPage } from '@/features/profile/wallets-page'

export const Route = createFileRoute('/_auth/perfil/carteiras')({
  component: WalletsPage,
})
