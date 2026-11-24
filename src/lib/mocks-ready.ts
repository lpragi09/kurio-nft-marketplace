/**
 * Resolves once the MSW worker controls the page (or immediately when mocks are off).
 * The UI renders right away (static content, skeletons); only network calls wait on it.
 */
let ready: Promise<void> = Promise.resolve()

export function setMocksReady(p: Promise<void>) {
  ready = p
}

export function mocksReady() {
  return ready
}
