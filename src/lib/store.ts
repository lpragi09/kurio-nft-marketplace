import { useSyncExternalStore } from 'react'

/** Minimal external store (no extra dependency) usable inside and outside React. */
export function createStore<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(next: T | ((prev: T) => T)) {
      state = typeof next === 'function' ? (next as (prev: T) => T)(state) : next
      listeners.forEach((l) => l())
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export type Store<T> = ReturnType<typeof createStore<T>>

export function useStore<T, S = T>(store: Store<T>, selector: (s: T) => S = (s) => s as unknown as S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(store.get()),
  )
}
