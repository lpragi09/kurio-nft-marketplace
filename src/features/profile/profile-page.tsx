import { zodResolver } from '@hookform/resolvers/zod'
import { ImageIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'
import type { z } from 'zod'
import type { User } from '@/contracts/api'
import { changePasswordFormSchema, profileSchema } from '@/contracts/schemas'
import { isApiError } from '@/api/http'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RequiredMark, TextField } from '@/components/kurio/form-field'
import { ErrorState } from '@/components/kurio/state-views'
import { useProfile, useProfileMutations } from '@/queries/account'

export function applyApiErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>) {
  if (!isApiError(error)) return toast.error('Não foi possível salvar. Tente novamente.')
  if (error.fields) {
    for (const [field, message] of Object.entries(error.fields)) setError(field as Path<T>, { type: 'server', message }, { shouldFocus: true })
  }
  toast.error(error.message)
}

export function ProfilePage() {
  const profile = useProfile()
  if (profile.isPending) {
    return (
      <div className="grid gap-6 sm:grid-cols-2" aria-busy="true" aria-label="Carregando perfil">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[70px]" />
        ))}
      </div>
    )
  }
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} retrying={profile.isFetching} />
  return (
    <>
      <ProfileForm user={profile.data} />
      <PasswordForm />
    </>
  )
}

function ProfileForm({ user }: { user: User }) {
  const { update } = useProfileMutations()
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: user.displayName, username: user.username, email: user.email, ensName: user.ensName, walletNickname: user.walletNickname },
  })
  const { errors, isDirty } = form.formState
  return (
    <form
      noValidate
      aria-labelledby="perfil-titulo"
      onSubmit={form.handleSubmit((v) =>
        update.mutate(v, {
          onSuccess: (u) => {
            form.reset({ displayName: u.displayName, username: u.username, email: u.email, ensName: u.ensName, walletNickname: u.walletNickname })
            toast.success('Perfil atualizado.')
          },
          onError: (e) => applyApiErrors(e, form.setError),
        }),
      )}
    >
      <h1 id="perfil-titulo" className="text-[18px] font-bold">
        Perfil do colecionador
      </h1>
      <div className="mt-8 grid gap-x-7 gap-y-8 sm:grid-cols-2">
        <TextField label="Nome de exibição" required autoComplete="name" error={errors.displayName?.message} {...form.register('displayName')} />
        <TextField label="Nome de usuário" required autoComplete="username" error={errors.username?.message} {...form.register('username')} />
        <TextField label="E-mail" required type="email" autoComplete="email" error={errors.email?.message} {...form.register('email')} />
        <div className="flex flex-col">
          <div className="mb-2 flex text-[15px]">
            <label htmlFor="profile-ens">Nome ENS</label>
            <RequiredMark />
          </div>
          <div className="flex gap-2.5">
            <span className="inline-flex h-10 items-center rounded-[4px] border border-kurio-line-2 px-3 text-[15px]">.eth</span>
            <input
              id="profile-ens"
              aria-invalid={Boolean(errors.ensName)}
              aria-describedby={errors.ensName ? 'profile-ens-error' : undefined}
              className="h-10 min-w-0 flex-1 rounded-[4px] border border-kurio-line-2 bg-kurio-bg/40 px-3 text-[15px] focus:border-primary focus:outline-none aria-[invalid=true]:border-kurio-coral"
              {...form.register('ensName')}
            />
          </div>
          {errors.ensName && (
            <p id="profile-ens-error" role="alert" className="mt-1 text-xs text-kurio-coral">
              {errors.ensName.message}
            </p>
          )}
        </div>
        <TextField label="Apelido da carteira" required error={errors.walletNickname?.message} {...form.register('walletNickname')} />
        <AvatarField user={user} />
      </div>
      <Button type="submit" className="mt-8 h-10 w-[131px]" disabled={update.isPending || !isDirty}>
        {update.isPending ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

/** Resizes the chosen image client-side (≤ 256px WebP) before uploading as a data URL. */
async function resizeImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const size = 256
  const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/webp', 0.85)
}

function AvatarField({ user }: { user: User }) {
  const { setAvatar, removeAvatar } = useProfileMutations()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = setAvatar.isPending || removeAvatar.isPending
  return (
    <div>
      <p id="avatar-label" className="mb-2 text-[15px]">
        Avatar
      </p>
      <div className="flex items-center gap-5" role="group" aria-labelledby="avatar-label">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={`Avatar atual de ${user.displayName}`} width={50} height={50} className="size-[50px] rounded-full border border-primary object-cover" />
        ) : (
          <span className="grid size-[50px] place-items-center rounded-full border border-kurio-line-2 bg-kurio-band text-primary">
            <ImageIcon className="size-6" aria-label="Sem avatar" />
          </span>
        )}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          id="avatar-input"
          aria-describedby={error ? 'avatar-error' : 'avatar-hint'}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            setError(null)
            if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError('Envie uma imagem PNG, JPG ou WebP.')
            if (file.size > 5 * 1024 * 1024) return setError('A imagem deve ter no máximo 5 MB.')
            try {
              const dataUrl = await resizeImage(file)
              setAvatar.mutate(dataUrl, {
                onSuccess: () => toast.success('Avatar atualizado.'),
                onError: (err) => setError(isApiError(err) ? err.message : 'Falha ao enviar o avatar.'),
              })
            } catch {
              setError('Não foi possível ler esta imagem.')
            }
          }}
        />
        <Button type="button" className="h-10 w-[98px]" onClick={() => input.current?.click()} disabled={busy}>
          {setAvatar.isPending ? 'Enviando…' : 'Alterar'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="font-normal"
          disabled={busy || !user.avatarUrl}
          onClick={() => removeAvatar.mutate(undefined, { onSuccess: () => toast.success('Avatar removido.') })}
        >
          Remover
        </Button>
      </div>
      {error ? (
        <p id="avatar-error" role="alert" className="mt-1 text-xs text-kurio-coral">
          {error}
        </p>
      ) : (
        <p id="avatar-hint" className="mt-1 text-xs text-kurio-khaki">
          PNG, JPG ou WebP até 5 MB.
        </p>
      )}
    </div>
  )
}

function PasswordForm() {
  const { changePassword } = useProfileMutations()
  const form = useForm<z.infer<typeof changePasswordFormSchema>>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const { errors } = form.formState
  useEffect(() => () => form.reset(), [form])
  return (
    <form
      noValidate
      aria-labelledby="senha-titulo"
      className="mt-10 max-w-[417px]"
      onSubmit={form.handleSubmit(({ confirmPassword: _c, ...v }) =>
        changePassword.mutate(v, {
          onSuccess: () => {
            form.reset()
            toast.success('Senha alterada com sucesso.')
          },
          onError: (e) => applyApiErrors(e, form.setError),
        }),
      )}
    >
      <h2 id="senha-titulo" className="text-[18px] font-bold">
        Alterar senha
      </h2>
      <div className="mt-6 space-y-5">
        <TextField label="Senha atual" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...form.register('currentPassword')} />
        <TextField label="Nova senha" type="password" autoComplete="new-password" hint="Mínimo de 8 caracteres, com letras e números." error={errors.newPassword?.message} {...form.register('newPassword')} />
        <TextField label="Confirmar nova senha" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...form.register('confirmPassword')} />
      </div>
      <Button type="submit" className="mt-8 h-10" disabled={changePassword.isPending}>
        {changePassword.isPending ? 'Alterando…' : 'Alterar senha'}
      </Button>
    </form>
  )
}
