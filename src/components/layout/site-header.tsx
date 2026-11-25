import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { LogIn, Search, ShoppingCart, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useCart } from '@/queries/cart'
import { useSession } from '@/session/session-store'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/kurio/avatar'
import { ComingSoon } from '@/components/kurio/coming-soon'

const AccountMenu = lazy(() => import('./account-menu'))

const navLink = 'relative inline-flex h-[45px] items-start pt-1 text-[15px] text-foreground transition-colors hover:text-primary'
const activeNav = 'text-primary font-bold after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full after:bg-primary'

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const marketActive = /^\/(nft|carrinho|pagamento|pedido)/.test(pathname)
  return (
    <header className="hidden md:block">
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center justify-between border-b border-kurio-line-2 px-6 xl:px-0">
        <Link to="/" className="w-40 text-sm font-bold tracking-[0.1em]" aria-label="Kurio, página inicial">
          KURIO
        </Link>
        <nav aria-label="Principal" className="flex items-end gap-10 self-end">
          <Link to="/" className={cn(navLink, !marketActive && pathname === '/' && activeNav)} activeOptions={{ exact: true }}>
            Início
          </Link>
          <Link to="/" hash="catalogo" className={cn(navLink, marketActive && activeNav)}>
            Mercado
          </Link>
          <ComingSoon className={navLink}>Criadores</ComingSoon>
          <ComingSoon className={navLink}>Aprenda</ComingSoon>
        </nav>
        <div className="flex w-52 items-center justify-end gap-6">
          <HeaderSearch />
          <CartButton />
          <AccountButton />
        </div>
      </div>
    </header>
  )
}

function HeaderSearch() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])
  if (!open) {
    return (
      <button type="button" aria-label="Buscar NFTs" className="rounded p-1 text-foreground hover:text-primary" onClick={() => setOpen(true)}>
        <Search className="size-6" aria-hidden />
      </button>
    )
  }
  return (
    <form
      role="search"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault()
        setOpen(false)
        void navigate({ to: '/', search: (prev) => ({ ...prev, q: value.trim() || undefined, pagina: undefined }), hash: 'catalogo' })
      }}
    >
      <label htmlFor="header-search" className="sr-only">
        Buscar NFTs
      </label>
      <input
        id="header-search"
        ref={input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder="Buscar NFTs…"
        className="h-9 w-48 rounded border border-kurio-line-2 bg-kurio-surface pl-3 pr-8 text-sm placeholder:text-kurio-khaki focus:border-primary focus:outline-none"
      />
      <button type="button" aria-label="Fechar busca" className="absolute right-2 top-2 text-kurio-sand" onClick={() => setOpen(false)}>
        <X className="size-5" aria-hidden />
      </button>
    </form>
  )
}

export function CartButton({ className }: { className?: string }) {
  const cart = useCart()
  const count = cart.data?.itemCount ?? 0
  return (
    <Link to="/carrinho" className={cn('relative rounded p-1 text-foreground hover:text-primary', className)} aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
      <ShoppingCart className="size-6" aria-hidden />
      {count > 0 && (
        <span aria-hidden className="absolute -right-1.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-kurio-bg">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

function AccountButton() {
  const { user } = useSession()
  const href = useRouterState({ select: (s) => s.location.href })
  if (!user) {
    return (
      <Link
        to="/entrar"
        search={{ redirect: href.startsWith('/entrar') || href.startsWith('/cadastro') ? undefined : href }}
        className="inline-flex h-[35px] items-center gap-1.5 rounded bg-primary px-2.5 text-[17px] font-bold text-kurio-bg hover:bg-kurio-orange-light"
      >
        <LogIn className="size-5" aria-hidden /> Entrar
      </Link>
    )
  }
  // the dropdown (Radix menu + floating-ui) only loads for signed-in users
  return (
    <Suspense fallback={<Avatar user={user} size={36} />}>
      <AccountMenu user={user} />
    </Suspense>
  )
}
