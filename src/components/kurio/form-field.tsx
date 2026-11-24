import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  required?: boolean
  /** visually hide the label (placeholder-only designs) — still read by screen readers */
  hideLabel?: boolean
  hint?: ReactNode
  inputClassName?: string
}

/** Input with an associated label, required marker and error message (aria-describedby). */
export const TextField = forwardRef<HTMLInputElement, FieldProps>(function TextField(
  { label, error, required, hideLabel, hint, className, inputClassName, type = 'text', id: idProp, ...props },
  ref,
) {
  const auto = useId()
  const id = idProp ?? auto
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const [reveal, setReveal] = useState(false)
  const isPassword = type === 'password'
  return (
    <div className={cn('flex flex-col', className)}>
      <div className={cn('mb-2 flex text-[15px]', hideLabel && 'sr-only')}>
        <label htmlFor={id}>{label}</label>
        {required && <RequiredMark />}
      </div>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={isPassword && reveal ? 'text' : type}
          aria-invalid={Boolean(error)}
          aria-required={required}
          aria-describedby={cn(error && errorId, hint && hintId) || undefined}
          className={cn(
            'h-10 w-full rounded-[4px] border border-kurio-line-2 bg-kurio-bg/40 px-3 text-[15px] text-foreground placeholder:text-kurio-khaki focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            error && 'border-kurio-coral',
            isPassword && 'pr-11',
            inputClassName,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
            aria-pressed={reveal}
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-kurio-khaki hover:text-foreground"
          >
            {reveal ? <Eye className="size-5" aria-hidden /> : <EyeOff className="size-5" aria-hidden />}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-kurio-khaki">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-kurio-coral">
          {error}
        </p>
      )}
    </div>
  )
})

/** Visual required marker kept outside <label> so it never pollutes the accessible name (aria-required carries the meaning). */
export function RequiredMark() {
  return (
    <span aria-hidden className="ml-0.5 text-kurio-coral">
      *
    </span>
  )
}
