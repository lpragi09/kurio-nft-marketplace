import { setupWorker } from 'msw/browser'
import { resetDb, setScenario } from './db'
import { controlHandlers, restHandlers } from './handlers'
import { realtimeHandlers } from './realtime'
import { buildScenario, isScenarioName } from './scenarios'
import { resumePendingOrders } from './service'

export const worker = setupWorker(...controlHandlers, ...restHandlers, ...realtimeHandlers)

/**
 * Boots the mock server. `?scenario=<name>` selects a scenario and `?mockReset=1`
 * restores the fixture snapshot; both params are removed from the URL afterwards.
 */
export async function startMocks() {
  const url = new URL(window.location.href)
  if (url.searchParams.get('mockReset') === '1') resetDb()
  const requested = url.searchParams.get('scenario')
  if (isScenarioName(requested)) setScenario(buildScenario(requested))
  if (url.searchParams.has('scenario') || url.searchParams.has('mockReset')) {
    url.searchParams.delete('scenario')
    url.searchParams.delete('mockReset')
    window.history.replaceState(window.history.state, '', url)
  }

  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
  resumePendingOrders()
}
