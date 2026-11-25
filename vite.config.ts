import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    preloadMocks(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // MSW's cookie jar is unused by this API (Bearer tokens); see the stub for details
      'tough-cookie': path.resolve(import.meta.dirname, './src/mocks/tough-cookie-stub.ts'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // keep form-only libraries out of chunks that the home page needs (icons are shared)
        advancedChunks: {
          groups: [
            { name: 'icons', test: /node_modules[\/]lucide-react/ },
            { name: 'forms', test: /node_modules[\/](react-hook-form|@hookform)/ },
          ],
        },
      },
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
})

/**
 * The mock server is a dynamic import (so the app can render first), which would make the
 * browser discover it only after the main chunk ran. Emit a modulepreload so it downloads
 * in parallel with the app.
 */
function preloadMocks(): Plugin {
  return {
    name: 'kurio-preload-mocks',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const chunk = Object.values(ctx.bundle ?? {}).find(
          (c) => c.type === 'chunk' && (c.facadeModuleId ?? '').split(String.fromCharCode(92)).join('/').endsWith('/src/mocks/browser.ts'),
        )
        if (!chunk || chunk.type !== 'chunk') return html
        const files = [chunk.fileName, ...chunk.imports]
        return {
          html,
          tags: files.map((f) => ({ tag: 'link', attrs: { rel: 'modulepreload', href: `/${f}` }, injectTo: 'head' as const })),
        }
      },
    },
  }
}
