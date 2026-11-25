/**
 * Build-time replacement for `tough-cookie` (aliased in vite.config.ts).
 *
 * MSW only uses tough-cookie for its in-browser cookie jar (request cookies derived from
 * previous mocked `Set-Cookie` headers). The Kurio API authenticates with a Bearer token
 * and never sets cookies, so the jar is always empty. Shipping tough-cookie + tldts
 * (~270 KB of source, ~60 KB gzip) only cost load time on mobile.
 * Limitation: mocked handlers cannot rely on cookie persistence.
 */
export class Cookie {
  static fromJSON(): null {
    return null
  }
}

export class MemoryCookieStore {
  idx: Record<string, never> = {}
}

export class CookieJar {
  constructor(_store?: unknown) {}
  getCookiesSync(_url: string): never[] {
    return []
  }
  async setCookie(_cookie: string, _url: string): Promise<void> {}
}

export default { Cookie, MemoryCookieStore, CookieJar }
