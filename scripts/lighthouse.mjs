// Lighthouse audit: home + NFT detail, mobile + desktop, 3 runs each, median per category.
// Usage: npm run build && npm run lighthouse   (serves dist/ with `vite preview`)
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'

const PORT = 4174
const BASE = process.env.LH_BASE_URL ?? `http://localhost:${PORT}`
const RUNS = Number(process.env.LH_RUNS ?? 3)
const OUT = path.resolve('lighthouse/reports')
const PAGES = [
  { name: 'inicio', path: '/' },
  { name: 'detalhe', path: '/nft/emerald-ape-042' },
]
const PROFILES = ['mobile', 'desktop']
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

async function waitFor(url, timeout = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`server did not start: ${url}`)
}

async function main() {
  let server
  if (!process.env.LH_BASE_URL) {
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
    await waitFor(BASE)
  }
  await mkdir(OUT, { recursive: true })
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox'] })
  const results = []
  try {
    for (const page of PAGES) {
      for (const profile of PROFILES) {
        const runs = []
        for (let i = 1; i <= RUNS; i++) {
          const config = profile === 'desktop' ? desktopConfig : undefined
          const res = await lighthouse(
            `${BASE}${page.path}`,
            { port: chrome.port, output: ['html', 'json'], logLevel: 'error', onlyCategories: CATEGORIES, formFactor: profile === 'desktop' ? 'desktop' : 'mobile' },
            config,
          )
          const lhr = res.lhr
          const base = `${page.name}-${profile}-run${i}`
          await writeFile(path.join(OUT, `${base}.html`), res.report[0])
          await writeFile(path.join(OUT, `${base}.json`), res.report[1])
          const run = {
            scores: Object.fromEntries(CATEGORIES.map((c) => [c, Math.round(lhr.categories[c].score * 100)])),
            lcp: lhr.audits['largest-contentful-paint'].numericValue,
            cls: lhr.audits['cumulative-layout-shift'].numericValue,
            tbt: lhr.audits['total-blocking-time'].numericValue,
            fcp: lhr.audits['first-contentful-paint'].numericValue,
          }
          runs.push(run)
          console.log(`${base}: ${JSON.stringify(run.scores)} LCP=${Math.round(run.lcp)}ms CLS=${run.cls.toFixed(3)} TBT=${Math.round(run.tbt)}ms`)
          if (i === 1) results.lighthouseVersion = lhr.lighthouseVersion
          if (i === 1) results.userAgent = lhr.environment.hostUserAgent
        }
        results.push({
          page: page.name,
          profile,
          median: {
            ...Object.fromEntries(CATEGORIES.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
            lcpMs: Math.round(median(runs.map((r) => r.lcp))),
            cls: Number(median(runs.map((r) => r.cls)).toFixed(3)),
            tbtMs: Math.round(median(runs.map((r) => r.tbt))),
            fcpMs: Math.round(median(runs.map((r) => r.fcp))),
          },
          runs,
        })
      }
    }
  } finally {
    await chrome.kill()
    server?.kill()
  }

  const env = {
    date: new Date().toISOString(),
    lighthouse: results.lighthouseVersion,
    chrome: results.userAgent,
    node: process.version,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: os.cpus()[0]?.model,
    target: BASE,
    runsPerPageProfile: RUNS,
    throttling: 'Lighthouse defaults (mobile: simulated slow 4G + 4x CPU; desktop: desktop-config)',
    scenario: 'padrao (mocks MSW ativos, latência 120 ms)',
  }
  await writeFile(path.join(OUT, 'summary.json'), JSON.stringify({ env, results: [...results] }, null, 2))
  const rows = results.map(
    (r) =>
      `| ${r.page} | ${r.profile} | ${r.median.performance} | ${r.median.accessibility} | ${r.median['best-practices']} | ${r.median.seo} | ${r.median.lcpMs} ms | ${r.median.cls} | ${r.median.tbtMs} ms |`,
  )
  const md = [
    '# Lighthouse — medianas (3 execuções por página/perfil)',
    '',
    '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    '## Ambiente',
    '',
    ...Object.entries(env).map(([k, v]) => `- **${k}**: ${v}`),
    '',
  ].join('\n')
  await writeFile(path.join(OUT, 'summary.md'), md)
  console.log(`\n${md}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
