import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Mounts below-the-fold content only when it approaches the viewport (600px margin),
 * keeping the initial render small. The placeholder reserves the height (no layout shift).
 */
export function LazySection({ children, minHeight }: { children: ReactNode; minHeight: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])
  if (visible) return <>{children}</>
  return <div ref={ref} aria-hidden style={{ minHeight }} />
}
