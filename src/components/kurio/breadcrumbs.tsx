import { Link } from '@tanstack/react-router'
import { Fragment } from 'react'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  to?: '/' | '/carrinho'
  hash?: string
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className={cn('mt-8', className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-[15px] font-bold">
        {items.map((c, i) => (
          <Fragment key={c.label}>
            {i > 0 && (
              <li aria-hidden className="text-foreground">
                /
              </li>
            )}
            <li>
              {c.to && i < items.length - 1 ? (
                <Link to={c.to} hash={c.hash} className="hover:text-primary">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className={i === items.length - 1 && c.to === undefined ? 'text-foreground' : ''}>
                  {c.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
