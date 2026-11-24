export type SocialName = 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'mail'

/** Brand glyphs drawn inline (lucide no longer ships brand icons). */
export function SocialIcon({ name, className }: { name: SocialName; className?: string }) {
  const common = { className, 'aria-hidden': true, fill: 'currentColor', viewBox: '0 0 24 24' } as const
  switch (name) {
    case 'facebook':
      return (
        <svg {...common}>
          <path d="M14 8V6.2c0-.8.2-1.2 1.4-1.2H17V2h-2.6C11.4 2 10.5 3.6 10.5 6.1V8H8v3h2.5v11H14V11h2.6l.4-3z" />
        </svg>
      )
    case 'instagram':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'twitter':
      return (
        <svg {...common}>
          <path d="M22 5.8c-.7.3-1.5.5-2.4.6.9-.5 1.5-1.3 1.8-2.3-.8.5-1.7.8-2.6 1-1.6-1.7-4.4-1.6-6 .2-.9 1-1.2 2.5-.9 3.8-3.3-.2-6.3-1.7-8.4-4.3-1.1 1.9-.5 4.3 1.3 5.5-.7 0-1.3-.2-1.9-.5 0 2 1.4 3.7 3.3 4.1-.6.2-1.2.2-1.9.1.5 1.7 2.1 2.9 3.9 2.9-1.7 1.3-3.8 2-6 1.8 1.9 1.2 4.1 1.9 6.4 1.9 7.7 0 12-6.4 12-12v-.5c.8-.6 1.5-1.3 2.1-2.1z" />
        </svg>
      )
    case 'linkedin':
      return (
        <svg {...common}>
          <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6.1V21h-4v-5.1c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4z" />
        </svg>
      )
    case 'youtube':
      return (
        <svg {...common}>
          <path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.8 15V9l5.7 3z" />
        </svg>
      )
    case 'mail':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      )
  }
}
