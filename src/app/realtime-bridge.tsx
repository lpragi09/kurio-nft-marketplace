import { useQueryClient } from '@tanstack/react-query'
import { WifiOff } from 'lucide-react'
import { useEffect } from 'react'
import { useStore } from '@/lib/store'
import { RealtimeClient, realtimeStatus } from '@/realtime/realtime-client'
import { useSession } from '@/session/session-store'

/**
 * One socket per session: when the token changes (login, logout, user switch) the
 * previous socket and all its listeners are torn down before a new one is opened.
 */
export function RealtimeBridge() {
  const qc = useQueryClient()
  const { token, user } = useSession()
  const userId = user?.id ?? null
  useEffect(() => {
    const client = new RealtimeClient(qc, { token, userId })
    void client.start()
    ;(window as unknown as { __kurioRealtime?: RealtimeClient }).__kurioRealtime = client
    return () => client.stop()
  }, [qc, token, userId])
  return <ConnectionBanner />
}

function ConnectionBanner() {
  const status = useStore(realtimeStatus)
  const show = status === 'reconnecting' || status === 'offline'
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-2 z-50 flex justify-center px-4">
      {show && (
        <p className="pointer-events-auto inline-flex items-center gap-2 rounded border border-kurio-coral/60 bg-kurio-surface px-3 py-1.5 text-xs text-kurio-cream shadow-lg" data-testid="realtime-status">
          <WifiOff className="size-3.5 text-kurio-coral" aria-hidden />
          {status === 'offline' ? 'Tempo real indisponível — tentando conectar…' : 'Conexão em tempo real perdida — reconectando…'}
        </p>
      )}
    </div>
  )
}
