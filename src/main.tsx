import '@fontsource/roboto-mono/latin-400.css'
import '@fontsource/roboto-mono/latin-500.css'
import '@fontsource/roboto-mono/latin-700.css'
import './index.css'
import { render } from './app/bootstrap'
import { setMocksReady } from './lib/mocks-ready'

// The mock server is enabled by configuration and ships with the demo build.
// The app renders immediately; HTTP (axios interceptor) and Socket.IO (dynamic import of
// socket.io-client, which captures the WebSocket constructor at evaluation time) wait for it.
if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
  setMocksReady(import('./mocks/browser').then((m) => m.startMocks()))
}
render()
