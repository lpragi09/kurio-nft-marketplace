import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/**
 * Out-of-scope actions (editorial pages, support, activity…). They stay visible to
 * preserve the layout but never pretend to succeed: they announce they are unavailable.
 */
export function ComingSoon({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <button
      type="button"
      aria-disabled="true"
      title="Disponível em breve"
      className={cn('cursor-not-allowed', className)}
      onClick={() => toast.info(`${label ?? (typeof children === 'string' ? children : 'Esta seção')} estará disponível em breve.`)}
    >
      {children}
      <span className="sr-only"> (em breve)</span>
    </button>
  )
}
