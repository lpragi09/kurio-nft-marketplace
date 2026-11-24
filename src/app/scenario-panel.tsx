import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCart } from '@/queries/cart'
import { eth } from '@/lib/eth'
import { mocksReady } from '@/lib/mocks-ready'

interface MockState {
  scenario: { name: string }
  scenarios: { name: string; label: string; description: string }[]
  sockets: number
}

async function control<T = unknown>(path: string, body?: unknown): Promise<T> {
  await mocksReady()
  const res = await fetch(`/__mock${path}`, {
    method: body === undefined && path === '/state' ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return (await res.json()) as T
}

/**
 * Demo/QA panel for the MSW mock server. Every action goes through MSW control
 * routes (/__mock/*), which mutate the mock DB; the UI only learns about changes via
 * REST responses and Socket.IO events — nothing is pushed into the cache directly.
 */
export function ScenarioPanel() {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()
  const cart = useCart()
  const state = useQuery({ queryKey: ['__mock', 'state'], queryFn: () => control<MockState>('/state'), enabled: open, refetchInterval: open ? 2000 : false })
  const firstLine = cart.data?.lines[0]

  const run = async (label: string, fn: () => Promise<unknown>) => {
    await fn()
    toast.info(label)
    void state.refetch()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="scenario-panel"
        className="fixed bottom-24 left-3 z-50 inline-flex items-center gap-1.5 rounded-full border border-primary bg-kurio-surface px-3 py-2 text-xs font-bold text-primary shadow-lg md:bottom-4"
      >
        <FlaskConical className="size-4" aria-hidden /> Cenários
      </button>
      {open && (
        <section
          id="scenario-panel"
          aria-label="Painel de cenários simulados"
          className="fixed bottom-36 left-3 z-50 max-h-[70vh] w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded border border-kurio-line-2 bg-kurio-surface p-4 text-sm shadow-2xl md:bottom-16"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Cenários do mock (MSW)</h2>
            <button type="button" aria-label="Fechar painel" onClick={() => setOpen(false)}>
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <p className="mt-1 text-xs text-kurio-khaki">Sockets conectados: {state.data?.sockets ?? '–'}</p>
          <label htmlFor="scenario-select" className="mt-3 block text-xs font-bold">
            Cenário ativo
          </label>
          <select
            id="scenario-select"
            className="mt-1 h-9 w-full rounded border border-kurio-line-2 bg-kurio-bg px-2"
            value={state.data?.scenario.name ?? 'padrao'}
            onChange={(e) =>
              run(`Cenário: ${e.target.selectedOptions[0]?.text}`, async () => {
                await control('/scenario', { name: e.target.value })
                await qc.invalidateQueries()
              })
            }
          >
            {state.data?.scenarios.map((s) => (
              <option key={s.name} value={s.name} title={s.description}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-kurio-khaki">{state.data?.scenarios.find((s) => s.name === state.data?.scenario.name)?.description}</p>

          <div className="mt-4 grid gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!firstLine}
              onClick={() =>
                firstLine &&
                run('Preço alterado no servidor (evento nft.updated emitido).', () =>
                  control(`/nfts/${firstLine.nftId}`, { edition: firstLine.edition, editionPrice: eth(firstLine.unitPrice).plus('0.10').toString() }),
                )
              }
            >
              Subir preço do 1º item do carrinho
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!firstLine}
              onClick={() =>
                firstLine &&
                run('Disponibilidade reduzida no servidor.', () => control(`/nfts/${firstLine.nftId}`, { edition: firstLine.edition, available: 1 }))
              }
            >
              Reduzir estoque do 1º item para 1
            </Button>
            <Button size="sm" variant="outline" onClick={() => run('Sockets derrubados; o cliente vai reconectar.', () => control('/sockets/drop', {}))}>
              Derrubar conexão Socket.IO
            </Button>
            <Button size="sm" variant="outline" onClick={() => run('Sessões expiradas no servidor.', () => control('/sessions/expire', {}))}>
              Expirar sessão
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                run('Mock restaurado para o cenário padrão.', async () => {
                  await control('/reset', {})
                  localStorage.removeItem('kurio.session.v1')
                  localStorage.removeItem('kurio.coupon.v1')
                  localStorage.removeItem('kurio.checkout.attempt.v1')
                  sessionStorage.clear()
                  window.location.reload()
                })
              }
            >
              Resetar dados e cenário
            </Button>
          </div>
        </section>
      )}
    </>
  )
}
