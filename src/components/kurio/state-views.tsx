import { AlertTriangle, RefreshCw, SearchX, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { isApiError } from '@/api/http'
import { Button } from '@/components/ui/button'

export function ErrorState({ error, onRetry, retrying, title }: { error: unknown; onRetry?: () => void; retrying?: boolean; title?: string }) {
  const offline = isApiError(error) && (error.code === 'NETWORK' || error.code === 'TIMEOUT')
  const message = isApiError(error) ? error.message : 'Algo deu errado.'
  const Icon = offline ? WifiOff : AlertTriangle
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded border border-kurio-line bg-kurio-surface px-6 py-10 text-center">
      <Icon className="size-8 text-kurio-coral" aria-hidden />
      <h2 className="text-lg font-bold">{title ?? (offline ? 'Sem conexão' : 'Não foi possível carregar')}</h2>
      <p className="max-w-md text-sm text-kurio-sand">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} disabled={retrying} className="mt-2">
          <RefreshCw className={retrying ? 'animate-spin' : ''} aria-hidden /> {retrying ? 'Tentando…' : 'Tentar novamente'}
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 rounded border border-dashed border-kurio-line-2 px-6 py-12 text-center">
      <SearchX className="size-8 text-primary" aria-hidden />
      <h2 className="text-lg font-bold">{title}</h2>
      {children && <div className="max-w-md text-sm text-kurio-sand">{children}</div>}
      {action}
    </div>
  )
}

/** Subtle indicator for background refetches (data already on screen). */
export function BackgroundRefresh({ active }: { active: boolean }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex h-5 items-center gap-1.5 text-xs text-kurio-khaki">
      {active && (
        <>
          <RefreshCw className="size-3 animate-spin" aria-hidden /> Atualizando…
        </>
      )}
    </span>
  )
}
