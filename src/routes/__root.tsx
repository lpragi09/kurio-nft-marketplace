import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { MobileTabBar } from '@/components/layout/mobile-nav'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { LazySection } from '@/components/kurio/lazy-section'
import { RealtimeBridge } from '@/app/realtime-bridge'
import { ScenarioPanel } from '@/app/scenario-panel'
import { SessionWatcher } from '@/app/session-watcher'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

const MOCKS_ENABLED = import.meta.env.VITE_ENABLE_MOCKS !== 'false'

function RootLayout() {
  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-kurio-bg">
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <RouteAnnouncer />
      <main id="conteudo" tabIndex={-1} className="min-h-[100dvh] outline-none">
        <Outlet />
      </main>
      <LazySection minHeight={900}>
        <SiteFooter />
      </LazySection>
      <MobileTabBar />
      <SessionWatcher />
      <RealtimeBridge />
      {MOCKS_ENABLED && <ScenarioPanel />}
      <Toaster position="bottom-right" richColors closeButton />
    </>
  )
}

/** Announces client-side navigations to screen readers and resets focus. */
function RouteAnnouncer() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (window.location.hash) return
    document.getElementById('conteudo')?.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

export function NotFound() {
  return (
    <section className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-6 py-24 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="max-w-md text-kurio-sand">O endereço acessado não existe ou foi removido. Que tal explorar o mercado?</p>
      <Link to="/" className="mt-2 rounded bg-primary px-6 py-2.5 font-bold text-kurio-bg hover:bg-kurio-orange-light">
        Voltar ao início
      </Link>
    </section>
  )
}
