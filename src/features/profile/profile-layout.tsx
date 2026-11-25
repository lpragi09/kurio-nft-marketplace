import { useQueryClient } from '@tanstack/react-query'
import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { Download, Heart, LifeBuoy, LineChart, LogOut, MapPin, ShoppingCart, User } from 'lucide-react'
import { toast } from 'sonner'
import { ComingSoon } from '@/components/kurio/coming-soon'
import { MobileTopBar } from '@/components/layout/mobile-nav'
import { logout } from '@/session/auth-actions'

const item = 'relative flex items-center gap-3 whitespace-nowrap px-4 py-3 text-[15px] text-primary hover:bg-kurio-surface-2'
const active = 'before:absolute before:inset-y-0 before:left-0 before:w-[5px] before:bg-primary bg-kurio-surface-2/40'

export function ProfileLayout() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  return (
    <>
      <MobileTopBar title="Meu perfil" />
      <div className="mx-auto grid max-w-[1200px] gap-7 px-6 md:mt-8 lg:grid-cols-[310px_1fr] xl:px-0">
        <nav aria-label="Meu perfil" className="no-scrollbar h-fit bg-kurio-surface pb-1 max-lg:overflow-x-auto">
          <h2 className="px-3 pb-2 pt-4 text-lg font-bold max-lg:hidden">Meu perfil</h2>
          <ul className="flex lg:block">
            <li>
              <Link to="/perfil" activeOptions={{ exact: true }} className={item} activeProps={{ className: active, 'aria-current': 'page' }}>
                <User className="size-4" aria-hidden /> Dados do perfil
              </Link>
            </li>
            <li>
              <Link to="/perfil/carteiras" className={item} activeProps={{ className: active, 'aria-current': 'page' }}>
                <MapPin className="size-4" aria-hidden /> Carteiras
              </Link>
            </li>
            <li className="max-lg:hidden">
              <ComingSoon className={`${item} w-full`}>
                <ShoppingCart className="size-4" aria-hidden /> Atividade
              </ComingSoon>
            </li>
            <li>
              <Link to="/favoritos" className={item}>
                <Heart className="size-4" aria-hidden /> Lista de interesse
              </Link>
            </li>
            <li className="max-lg:hidden">
              <ComingSoon className={`${item} w-full`} label="Ofertas">
                <LineChart className="size-4" aria-hidden /> Ofertas
              </ComingSoon>
            </li>
            <li className="max-lg:hidden">
              <ComingSoon className={`${item} w-full`} label="Arquivos baixados">
                <Download className="size-4" aria-hidden /> Arquivos baixados
              </ComingSoon>
            </li>
            <li className="max-lg:hidden">
              <ComingSoon className={`${item} w-full`} label="Suporte">
                <LifeBuoy className="size-4" aria-hidden /> Suporte
              </ComingSoon>
            </li>
            <li className="lg:border-t lg:border-kurio-line-2">
              <button
                type="button"
                className={`${item} w-full font-bold`}
                onClick={async () => {
                  await logout(qc)
                  toast.success('Você saiu da sua conta.')
                  void navigate({ to: '/' })
                }}
              >
                <LogOut className="size-4" aria-hidden /> Sair
              </button>
            </li>
          </ul>
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </>
  )
}
