import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'
import type { z } from 'zod'
import { authApi } from '@/api/endpoints'
import { isApiError } from '@/api/http'
import { loginSchema, registerFormSchema } from '@/contracts/schemas'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ComingSoon } from '@/components/kurio/coming-soon'
import { TextField } from '@/components/kurio/form-field'
import { completeLogin } from '@/session/auth-actions'
import { HeroBackdrop } from './hero-backdrop'

type Mode = 'login' | 'register'

export function safeRedirect(redirect?: string) {
  return redirect && redirect.startsWith('/') && !redirect.startsWith('//') && !/^\/(entrar|cadastro)/.test(redirect) ? redirect : '/'
}

export function AuthScreen({ mode, redirect, reason }: { mode: Mode; redirect?: string; reason?: string }) {
  const desktop = useMediaQuery('(min-width: 768px)')
  const navigate = useNavigate()
  const content = <AuthPanel mode={mode} redirect={redirect} reason={reason} />
  if (!desktop) {
    return <div className="mx-auto max-w-[414px] px-6 pb-10 pt-16">{content}</div>
  }
  return (
    <>
      <HeroBackdrop />
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) void navigate({ href: redirect && !redirect.startsWith('/pagamento') && !redirect.startsWith('/perfil') ? safeRedirect(redirect) : '/' })
        }}
      >
        <DialogContent className="max-w-[500px] px-0 pb-12 pt-12 sm:max-w-[500px]" aria-describedby="auth-desc">
          {content}
        </DialogContent>
      </Dialog>
    </>
  )
}

function AuthPanel({ mode, redirect, reason }: { mode: Mode; redirect?: string; reason?: string }) {
  const desc =
    mode === 'login'
      ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.'
      : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'
  return (
    <div className="flex flex-col items-center">
      <p className="mb-10 text-[34px] font-bold tracking-[0.1em] md:hidden" aria-hidden>
        KURIO
      </p>
      <DialogTitleSafe>
        <span className="hidden md:inline">
          <Link to="/entrar" search={{ redirect }} replace className={cn(mode === 'login' ? 'text-primary' : 'text-foreground hover:text-primary')} aria-current={mode === 'login' ? 'page' : undefined}>
            Entrar
          </Link>
          <span aria-hidden className="mx-1.5 text-primary">|</span>
          <Link to="/cadastro" search={{ redirect }} replace className={cn(mode === 'register' ? 'text-primary' : 'text-foreground hover:text-primary')} aria-current={mode === 'register' ? 'page' : undefined}>
            Criar conta
          </Link>
        </span>
        <span className="md:hidden">{mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'}</span>
      </DialogTitleSafe>
      <DescriptionSafe>{desc}</DescriptionSafe>
      {reason === 'expirada' && (
        <p role="status" className="mx-20 mt-4 w-[calc(100%-2rem)] rounded border border-primary/60 bg-kurio-band px-3 py-2 text-center text-xs md:w-[340px]">
          Sua sessão expirou. Entre novamente para retomar de onde parou.
        </p>
      )}
      <div className="mt-6 w-full md:w-[340px]">{mode === 'login' ? <LoginForm redirect={redirect} /> : <RegisterForm redirect={redirect} />}</div>
      <div className="mt-8 flex w-full items-center gap-3 md:w-full md:px-0">
        <span className="h-px flex-1 bg-kurio-line-2" />
        <span className="text-[13px]">Ou continue com</span>
        <span className="h-px flex-1 bg-kurio-line-2" />
      </div>
      <div className="mt-4 flex w-full flex-col gap-3 md:w-[340px]">
        <ComingSoon label="O login com Google" className="flex h-10 items-center justify-center gap-2 rounded border border-kurio-line-2 text-[13px] hover:border-primary">
          <GoogleIcon /> Continuar com Google
        </ComingSoon>
        <ComingSoon label="O login com Facebook" className="flex h-10 items-center justify-center gap-2 rounded border border-kurio-line-2 text-[13px] hover:border-primary">
          <span aria-hidden className="text-lg font-bold text-[#3b5999]">f</span> Continuar com Facebook
        </ComingSoon>
      </div>
      <p className="mt-10 text-[15px] md:hidden">
        {mode === 'login' ? (
          <>
            Novo na Kurio?{' '}
            <Link to="/cadastro" search={{ redirect }} className="text-primary underline">
              Crie uma conta
            </Link>
          </>
        ) : (
          <>
            Já tem uma conta?{' '}
            <Link to="/entrar" search={{ redirect }} className="text-primary underline">
              Entre
            </Link>
          </>
        )}
      </p>
    </div>
  )
}

/** DialogTitle only exists inside a Dialog; on mobile the panel is a page. */
function DialogTitleSafe({ children }: { children: React.ReactNode }) {
  const desktop = useMediaQuery('(min-width: 768px)')
  const cls = 'text-center text-[20px] font-bold md:text-[20px]'
  return desktop ? <DialogTitle className={cls}>{children}</DialogTitle> : <h1 className={cls}>{children}</h1>
}
function DescriptionSafe({ children }: { children: React.ReactNode }) {
  const desktop = useMediaQuery('(min-width: 768px)')
  const cls = 'mt-6 hidden max-w-[400px] px-6 text-center text-[13px] md:block'
  return desktop ? (
    <DialogDescription id="auth-desc" className={cls}>
      {children}
    </DialogDescription>
  ) : (
    <p className={cls}>{children}</p>
  )
}

function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fallbackField: Path<T>) {
  if (!isApiError(error)) return toast.error('Não foi possível concluir. Tente novamente.')
  if (error.fields && Object.keys(error.fields).length) {
    for (const [field, message] of Object.entries(error.fields)) setError(field as Path<T>, { type: 'server', message }, { shouldFocus: true })
  } else {
    setError(fallbackField, { type: 'server', message: error.message }, { shouldFocus: true })
  }
}

function LoginForm({ redirect }: { redirect?: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (session) => {
      await completeLogin(qc, session)
      toast.success(`Bem-vindo de volta, ${session.user.displayName}!`)
      void navigate({ href: safeRedirect(redirect), replace: true })
    },
    onError: (e) => applyServerErrors(e, form.setError, 'password'),
  })
  const { errors } = form.formState
  return (
    <form noValidate onSubmit={form.handleSubmit((v) => login.mutate(v))} className="flex flex-col gap-3" aria-label="Entrar">
      <TextField label="E-mail" hideLabel type="email" autoComplete="email" placeholder="contato@email.com" error={errors.email?.message} required {...form.register('email')} />
      <TextField label="Senha" hideLabel type="password" autoComplete="current-password" placeholder="Senha" error={errors.password?.message} required {...form.register('password')} />
      <ComingSoon label="A recuperação de senha" className="self-end text-[15px] text-primary hover:underline">
        Esqueceu a senha?
      </ComingSoon>
      <Button type="submit" className="mt-4 h-11 text-[16px] max-md:h-[60px] max-md:rounded-[10px]" disabled={login.isPending}>
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}

function RegisterForm({ redirect }: { redirect?: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const form = useForm<z.infer<typeof registerFormSchema>>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })
  const register = useMutation({
    mutationFn: authApi.register,
    onSuccess: async (session) => {
      await completeLogin(qc, session)
      toast.success('Conta criada! Bem-vindo à Kurio.')
      void navigate({ href: safeRedirect(redirect), replace: true })
    },
    onError: (e) => applyServerErrors(e, form.setError, 'email'),
  })
  const { errors } = form.formState
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(({ confirmPassword: _c, ...v }) => register.mutate(v))}
      className="flex flex-col gap-3"
      aria-label="Criar conta"
    >
      <TextField label="Nome de usuário" hideLabel autoComplete="username" placeholder="Nome de usuário" error={errors.username?.message} required {...form.register('username')} />
      <TextField label="E-mail" hideLabel type="email" autoComplete="email" placeholder="Digite seu e-mail" error={errors.email?.message} required {...form.register('email')} />
      <TextField label="Senha" hideLabel type="password" autoComplete="new-password" placeholder="Senha" error={errors.password?.message} hint="Mínimo de 8 caracteres, com letras e números." required {...form.register('password')} />
      <TextField label="Confirmar senha" hideLabel type="password" autoComplete="new-password" placeholder="Confirmar senha" error={errors.confirmPassword?.message} required {...form.register('confirmPassword')} />
      <Button type="submit" className="mt-4 h-11 text-[16px] max-md:h-[60px] max-md:rounded-[10px]" disabled={register.isPending}>
        {register.isPending ? 'Criando…' : 'Criar conta'}
      </Button>
    </form>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.4 9.1 5.4 12 5.4z" />
    </svg>
  )
}
