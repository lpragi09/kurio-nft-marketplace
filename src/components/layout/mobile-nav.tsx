import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import { ChevronLeft, Heart, Home, ScanLine, ShoppingCart, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useCart } from '@/queries/cart'
import { useSession } from '@/session/session-store'
import { ComingSoon } from '@/components/kurio/coming-soon'

/** Bottom tab bar from the mobile frames (≤ 767px). */
export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { user } = useSession()
  const cart = useCart()
  const count = cart.data?.itemCount ?? 0
  const item = 'grid size-11 place-items-center rounded-full text-kurio-sand hover:text-primary'
  const active = 'text-primary'
  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="relative mx-auto flex h-[70px] max-w-[480px] items-center justify-between rounded-t-[30px] bg-kurio-surface px-8 shadow-[0_-10px_30px_rgba(0,0,0,0.4)]">
        <Link to="/" aria-label="Início" className={cn(item, pathname === '/' && active)}>
          <Home className="size-6" fill="currentColor" aria-hidden />
        </Link>
        <Link to="/favoritos" aria-label="Favoritos" className={cn(item, pathname === '/favoritos' && active)}>
          <Heart className="size-6" fill="currentColor" aria-hidden />
        </Link>
        <span className="w-16" aria-hidden />
        <ComingSoon
          label="O escaneamento de NFTs"
          className="absolute left-1/2 top-[-28px] grid size-16 -translate-x-1/2 place-items-center rounded-full border-[6px] border-kurio-bg bg-primary text-kurio-bg"
        >
          <ScanLine className="size-6" aria-label="Escanear NFT" />
        </ComingSoon>
        <Link to="/carrinho" aria-label={`Carrinho, ${count} itens`} className={cn(item, 'relative', pathname === '/carrinho' && active)}>
          <ShoppingCart className="size-6" aria-hidden />
          {count > 0 && (
            <span aria-hidden className="absolute right-0 top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-kurio-bg">
              {count}
            </span>
          )}
        </Link>
        <Link
          to={user ? '/perfil' : '/entrar'}
          aria-label={user ? 'Meu perfil' : 'Entrar'}
          className={cn(item, pathname.startsWith('/perfil') && active)}
        >
          <User className="size-6" fill="currentColor" aria-hidden />
        </Link>
      </div>
    </nav>
  )
}

/** Top bar used by mobile frames (back button + title + optional action). */
export function MobileTopBar({ title, action, back }: { title?: string; action?: ReactNode; back?: string }) {
  const router = useRouter()
  return (
    <div className="flex items-center justify-between gap-3 px-6 pb-3 pt-6 md:hidden">
      <button
        type="button"
        aria-label="Voltar"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-kurio-surface-2 text-kurio-sand"
        onClick={() => (back ? void router.navigate({ to: back }) : router.history.canGoBack() ? router.history.back() : void router.navigate({ to: '/' }))}
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      {title && <h1 className="flex-1 text-center text-xl font-bold">{title}</h1>}
      <div className="flex size-9 shrink-0 items-center justify-center">{action}</div>
    </div>
  )
}
