import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { z } from 'zod'
import type { Wallet, WalletInput, WalletSlot } from '@/contracts/api'
import { walletSchema } from '@/contracts/schemas'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { RequiredMark, TextField } from '@/components/kurio/form-field'
import { ErrorState } from '@/components/kurio/state-views'
import { NETWORK_LABELS } from '@/features/catalog/catalog-search'
import { useSaveWallet, useWallets } from '@/queries/account'
import { useSession } from '@/session/session-store'
import { applyApiErrors } from './profile-page'

const PROVIDER_LABELS = { metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase Wallet' } as const
type WalletFormValues = z.infer<typeof walletSchema>

export function WalletsPage() {
  const wallets = useWallets()
  const [showSecondary, setShowSecondary] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)
  if (wallets.isPending) {
    return (
      <div className="grid gap-6 sm:grid-cols-2" aria-busy="true" aria-label="Carregando carteiras">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[70px]" />
        ))}
      </div>
    )
  }
  if (wallets.isError) return <ErrorState error={wallets.error} onRetry={() => wallets.refetch()} retrying={wallets.isFetching} />
  const primary = wallets.data.find((w) => w.slot === 'primary')
  const secondary = wallets.data.find((w) => w.slot === 'secondary')
  return (
    <div>
      <WalletForm key={primary?.id ?? 'new-primary'} slot="primary" wallet={primary} />
      <section aria-labelledby="secundaria" className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="secundaria" className="text-[18px] font-bold">
            Carteira secundária
          </h2>
          {!secondary && primary && (
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 text-[15px]">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={sameAsPrimary} onChange={(e) => setSameAsPrimary(e.target.checked)} />
                Igual à carteira principal
              </label>
              <button type="button" className="text-[18px] font-bold text-primary hover:underline" aria-expanded={showSecondary} onClick={() => setShowSecondary((v) => !v)}>
                {showSecondary ? 'Cancelar' : 'Adicionar'}
              </button>
            </div>
          )}
        </div>
        {secondary ? (
          <WalletForm key={secondary.id} slot="secondary" wallet={secondary} embedded />
        ) : showSecondary ? (
          <WalletForm key={`new-secondary-${sameAsPrimary}`} slot="secondary" prefill={sameAsPrimary ? primary : undefined} embedded onSaved={() => setShowSecondary(false)} />
        ) : (
          <p className="mt-2 text-[14px] text-kurio-sand">
            {primary ? 'Você ainda não adicionou uma carteira secundária.' : 'Cadastre a carteira principal antes da secundária.'}
          </p>
        )}
      </section>
    </div>
  )
}

function toValues(w?: Wallet, fallback?: Partial<Pick<Wallet, 'displayName' | 'nickname' | 'profileName' | 'network' | 'provider' | 'referralCode' | 'email' | 'ensName'>>): WalletFormValues {
  return {
    displayName: w?.displayName ?? fallback?.displayName ?? '',
    nickname: w?.nickname ?? fallback?.nickname ?? '',
    profileName: w?.profileName ?? fallback?.profileName ?? '',
    network: w?.network ?? fallback?.network ?? ('' as WalletFormValues['network']),
    address: w?.address ?? '',
    secondaryAddress: w?.secondaryAddress ?? '',
    provider: w?.provider ?? fallback?.provider ?? ('' as WalletFormValues['provider']),
    referralCode: w?.referralCode ?? fallback?.referralCode ?? '',
    email: w?.email ?? fallback?.email ?? '',
    ensName: w?.ensName ?? fallback?.ensName ?? '',
  }
}

function WalletForm({ slot, wallet, prefill, embedded, onSaved }: { slot: WalletSlot; wallet?: Wallet; prefill?: Wallet; embedded?: boolean; onSaved?: () => void }) {
  const { user } = useSession()
  const save = useSaveWallet()
  const form = useForm<WalletFormValues>({
    resolver: zodResolver(walletSchema),
    defaultValues: toValues(wallet, prefill ?? { displayName: user?.displayName, email: user?.email, ensName: user?.ensName }),
  })
  const { errors } = form.formState
  const titleId = `wallet-${slot}`
  return (
    <form
      noValidate
      aria-labelledby={embedded ? undefined : titleId}
      aria-label={embedded ? 'Carteira secundária' : undefined}
      onSubmit={form.handleSubmit((v) =>
        save.mutate(
          { id: wallet?.id, slot, body: v as WalletInput /* '' → null is normalised by the API */ },
          {
            onSuccess: (w) => {
              form.reset(toValues(w))
              toast.success(wallet ? 'Carteira atualizada.' : 'Carteira cadastrada.')
              onSaved?.()
            },
            onError: (e) => applyApiErrors(e, form.setError),
          },
        ),
      )}
      className={embedded ? 'mt-6' : ''}
    >
      {!embedded && (
        <>
          <div className="flex items-center justify-between">
            <h1 id={titleId} className="text-[18px] font-bold">
              Carteira principal
            </h1>
          </div>
          <p className="mt-1 text-[14px] text-kurio-sand">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
        </>
      )}
      <div className="mt-8 grid gap-x-7 gap-y-6 sm:grid-cols-2">
        <TextField label="Nome de exibição" required error={errors.displayName?.message} {...form.register('displayName')} />
        <TextField label="Apelido da carteira" required error={errors.nickname?.message} {...form.register('nickname')} />
        <WalletSelect form={form} name="network" label="Rede" placeholder="Selecione uma rede" options={NETWORK_LABELS} error={errors.network?.message} slot={slot} />
        <TextField label="Nome do perfil" required error={errors.profileName?.message} {...form.register('profileName')} />
        <TextField label="Endereço da carteira" required placeholder="Endereço 0x da carteira" spellCheck={false} error={errors.address?.message} {...form.register('address')} />
        <TextField label="ENS ou carteira secundária (opcional)" placeholder="ENS ou carteira secundária (opcional)" spellCheck={false} error={errors.secondaryAddress?.message} {...form.register('secondaryAddress')} />
        <WalletSelect form={form} name="provider" label="Tipo de carteira" placeholder="Selecione uma carteira" options={PROVIDER_LABELS} error={errors.provider?.message} slot={slot} />
        <TextField label="Código de indicação" required error={errors.referralCode?.message} {...form.register('referralCode')} />
        <TextField label="E-mail" required type="email" error={errors.email?.message} {...form.register('email')} />
        <TextField label="Nome ENS (sem .eth)" required error={errors.ensName?.message} {...form.register('ensName')} />
      </div>
      <Button type="submit" className="mt-8 h-10" disabled={save.isPending}>
        {save.isPending ? 'Salvando…' : 'Salvar carteira'}
      </Button>
    </form>
  )
}

function WalletSelect({
  form,
  name,
  label,
  placeholder,
  options,
  error,
  slot,
}: {
  form: ReturnType<typeof useForm<WalletFormValues>>
  name: 'network' | 'provider'
  label: string
  placeholder: string
  options: Record<string, string>
  error?: string
  slot: WalletSlot
}) {
  const id = `${slot}-${name}`
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex text-[15px]">
        <label htmlFor={id}>{label}</label>
        <RequiredMark />
      </div>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select value={field.value || undefined} onValueChange={field.onChange}>
            <SelectTrigger id={id} className="w-full" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(options).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-kurio-coral">
          {error}
        </p>
      )}
    </div>
  )
}
