import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  size = 'md',
  disabled,
}: {
  value: number
  min?: number
  max: number
  onChange: (next: number) => void
  label: string
  size?: 'sm' | 'md'
  disabled?: boolean
}) {
  const btn = cn(
    'grid place-items-center bg-primary text-kurio-bg transition hover:bg-kurio-orange-light disabled:cursor-not-allowed disabled:bg-kurio-surface-2 disabled:text-kurio-khaki',
    size === 'md' ? 'h-[46px] w-[31px] rounded-[20px]' : 'size-[22px] rounded-full',
  )
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-2.5">
      <button type="button" className={btn} aria-label={`Diminuir quantidade de ${label}`} disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
        <Minus className={size === 'md' ? 'size-6' : 'size-3.5'} aria-hidden strokeWidth={3} />
      </button>
      <output aria-live="polite" aria-label={`Quantidade de ${label}`} className={cn('min-w-6 text-center tabular-nums', size === 'md' ? 'text-[22px]' : 'text-lg')}>
        {value}
      </output>
      <button type="button" className={btn} aria-label={`Aumentar quantidade de ${label}`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        <Plus className={size === 'md' ? 'size-6' : 'size-3.5'} aria-hidden strokeWidth={3} />
      </button>
    </div>
  )
}
