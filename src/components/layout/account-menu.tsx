import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { LogOut, User as UserIcon, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import type { User } from '@/contracts/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar } from '@/components/kurio/avatar'
import { logout } from '@/session/auth-actions'

export default function AccountMenu({ user }: { user: User }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full" aria-label={`Conta de ${user.displayName}`}>
        <Avatar user={user} size={36} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border-kurio-line bg-kurio-surface">
        <DropdownMenuLabel className="truncate">{user.displayName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/perfil">
            <UserIcon aria-hidden /> Meu perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/perfil/carteiras">
            <Wallet aria-hidden /> Carteiras
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await logout(qc)
            toast.success('Você saiu da sua conta.')
            void navigate({ to: '/' })
          }}
        >
          <LogOut aria-hidden /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
