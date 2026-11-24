import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdateProfileRequest, User, WalletInput, WalletSlot } from '@/contracts/api'
import { profileApi, walletApi } from '@/api/endpoints'
import { sessionStore, useSession } from '@/session/session-store'
import { qk } from './client'

function syncSessionUser(user: User) {
  sessionStore.set((s) => (s.user?.id === user.id ? { ...s, user } : s))
}

export function useProfile() {
  const { user } = useSession()
  return useQuery({
    queryKey: qk.profile(user?.id ?? 'anon'),
    queryFn: async ({ signal }) => {
      const u = await profileApi.get({ signal })
      syncSessionUser(u)
      return u
    },
    enabled: Boolean(user),
  })
}

export function useProfileMutations() {
  const qc = useQueryClient()
  const { user } = useSession()
  const onUser = (u: User) => {
    qc.setQueryData(qk.profile(u.id), u)
    syncSessionUser(u)
  }
  return {
    update: useMutation({ mutationFn: (b: UpdateProfileRequest) => profileApi.update(b), onSuccess: onUser }),
    setAvatar: useMutation({ mutationFn: (dataUrl: string) => profileApi.setAvatar(dataUrl), onSuccess: onUser }),
    removeAvatar: useMutation({ mutationFn: () => profileApi.removeAvatar(), onSuccess: onUser }),
    changePassword: useMutation({ mutationFn: profileApi.changePassword }),
    userId: user?.id,
  }
}

export function useWallets() {
  const { user } = useSession()
  return useQuery({
    queryKey: qk.wallets(user?.id ?? 'anon'),
    queryFn: ({ signal }) => walletApi.list({ signal }),
    enabled: Boolean(user),
  })
}

export function useSaveWallet() {
  const qc = useQueryClient()
  const { user } = useSession()
  return useMutation({
    mutationFn: ({ id, slot, body }: { id?: string; slot: WalletSlot; body: WalletInput }) =>
      id ? walletApi.update(id, body) : walletApi.create(slot, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.wallets(user?.id ?? 'anon') }),
  })
}
