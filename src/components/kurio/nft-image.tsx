import { cn } from '@/lib/utils'

/**
 * Square NFT art served as WebP in 160/400/800 widths. Explicit width/height keep
 * the box stable (no CLS); `priority` is used for the LCP image.
 */
export function NftImage({
  base,
  alt,
  sizes = '(min-width: 1024px) 260px, 50vw',
  priority = false,
  className,
  decorative = false,
}: {
  base: string
  alt: string
  sizes?: string
  priority?: boolean
  className?: string
  decorative?: boolean
}) {
  return (
    <img
      src={`${base}-400.webp`}
      srcSet={`${base}-160.webp 160w, ${base}-400.webp 400w, ${base}-800.webp 800w`}
      sizes={sizes}
      alt={decorative ? '' : alt}
      width={400}
      height={400}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding={priority ? 'sync' : 'async'}
      className={cn('aspect-square h-auto w-full object-cover', className)}
    />
  )
}
