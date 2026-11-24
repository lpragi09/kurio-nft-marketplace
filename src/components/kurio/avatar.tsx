import { ImageIcon } from 'lucide-react'
import type { User } from '@/contracts/api'

export function Avatar({ user, size = 40 }: { user: Pick<User, 'avatarUrl' | 'displayName'> | null; size?: number }) {
  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={`Avatar de ${user.displayName}`}
        width={size}
        height={size}
        className="rounded-full border border-primary object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  const initial = user?.displayName?.trim()[0]?.toUpperCase()
  return (
    <span
      className="grid place-items-center rounded-full border border-kurio-line-2 bg-kurio-band font-bold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden={Boolean(initial)}
    >
      {initial ?? <ImageIcon className="size-1/2" aria-label="Sem avatar" />}
    </span>
  )
}
