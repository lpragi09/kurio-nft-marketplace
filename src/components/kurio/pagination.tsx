import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

function pages(current: number, total: number): (number | '…')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  // near the start: 1 2 3 4 … N (as in the Figma)
  if (current <= 3) return [1, 2, 3, 4, '…', total]
  if (current >= total - 2) return [1, '…', total - 3, total - 2, total - 1, total]
  const set = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total))
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push('…')
    out.push(p)
  })
  return out
}

export function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  const cell = 'grid size-[35px] place-items-center rounded border border-kurio-line-2 text-lg transition hover:border-primary'
  return (
    <nav aria-label="Paginação do catálogo" className="flex justify-end">
      <ul className="flex items-center gap-2">
        {page > 1 && (
          <li>
            <button type="button" className={cell} aria-label="Página anterior" onClick={() => onPage(page - 1)}>
              <ChevronLeft className="size-5" aria-hidden />
            </button>
          </li>
        )}
        {pages(page, totalPages).map((p, i) =>
          p === '…' ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-kurio-khaki">
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                className={cn(cell, p === page && 'border-primary bg-primary font-bold text-kurio-bg')}
                aria-label={`Página ${p}`}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onPage(p)}
              >
                {p}
              </button>
            </li>
          ),
        )}
        {page < totalPages && (
          <li>
            <button type="button" className={cell} aria-label="Próxima página" onClick={() => onPage(page + 1)}>
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
}
