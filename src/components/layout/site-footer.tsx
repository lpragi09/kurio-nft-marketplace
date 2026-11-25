import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ComingSoon } from '@/components/kurio/coming-soon'
import { SocialIcon, type SocialName } from '@/components/kurio/social-icons'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const SOCIAL: { name: SocialName; label: string; href: string }[] = [
  { name: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/' },
  { name: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/' },
  { name: 'twitter', label: 'Twitter', href: 'https://twitter.com/' },
  { name: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/' },
  { name: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/' },
]

const linkCls = 'text-[15px] text-foreground hover:text-primary text-left'

export function SiteFooter() {
  return (
    <footer className="mt-24 pb-24 md:pb-4">
      <div className="mx-auto max-w-[1200px] bg-kurio-surface">
        <div className="grid grid-cols-1 gap-8 px-6 py-8 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.35fr] lg:gap-0 lg:px-12">
          {FEATURES.map((f) => (
            <div key={f.letter} className="lg:border-r lg:border-primary lg:pr-4 lg:[&:not(:first-child)]:pl-4">
              <span aria-hidden className="grid size-[74px] place-items-center rounded-full bg-primary text-2xl font-bold text-kurio-bg">
                {f.letter}
              </span>
              <h2 className="mt-5 text-lg font-bold">{f.title}</h2>
              <p className="mt-3 max-w-[230px] text-[15px] leading-[22px] text-kurio-khaki">{f.text}</p>
            </div>
          ))}
          <NewsletterForm />
        </div>
        <div className="grid grid-cols-1 gap-4 bg-kurio-band px-6 py-6 text-[15px] sm:grid-cols-2 lg:grid-cols-4 lg:items-center lg:px-8">
          <span className="font-bold tracking-[0.1em]">KURIO</span>
          <span className="max-w-[230px]">Feito para colecionadores, criadores e cultura</span>
          <a href="mailto:contato@email.com" className="hover:text-primary">
            contato@email.com
          </a>
          <a href="tel:+551140028922" className="hover:text-primary">
            +55 11 4002 8922
          </a>
        </div>
        <div className="grid grid-cols-1 gap-8 px-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <FooterColumn title="Meu perfil">
            <Link to="/perfil" className={linkCls}>Meu perfil</Link>
            <ComingSoon className={linkCls}>Minha coleção</ComingSoon>
            <ComingSoon className={linkCls}>Atividade</ComingSoon>
            <ComingSoon className={linkCls}>Estúdio do criador</ComingSoon>
            <Link to="/favoritos" className={linkCls}>Lista de interesse</Link>
          </FooterColumn>
          <FooterColumn title="Central de ajuda">
            <ComingSoon className={linkCls}>Central de ajuda</ComingSoon>
            <ComingSoon className={linkCls}>Como comprar NFTs</ComingSoon>
            <ComingSoon className={linkCls}>Carteira e segurança</ComingSoon>
            <ComingSoon className={linkCls}>Política do mercado</ComingSoon>
            <ComingSoon className={linkCls}>Denunciar item</ComingSoon>
          </FooterColumn>
          <FooterColumn title="Coleções">
            {[
              ['arte-digital', 'Arte digital'],
              ['fotografia', 'Fotografia'],
              ['musica', 'Música'],
              ['arte-3d', 'Arte 3D'],
              ['utilidade', 'Utilidade'],
            ].map(([slug, label]) => (
              <Link key={slug} to="/" search={{ cat: slug }} hash="catalogo" className={linkCls}>
                {label}
              </Link>
            ))}
          </FooterColumn>
          <div>
            <h2 className="text-lg font-bold">Redes sociais</h2>
            <ul className="mt-3 flex gap-2">
              {SOCIAL.map((s) => (
                <li key={s.name}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${s.label} (abre em nova aba)`}
                    className="grid size-8 place-items-center rounded border border-primary text-primary hover:bg-primary hover:text-kurio-bg"
                  >
                    <SocialIcon name={s.name} className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
            <h2 className="mt-6 text-lg font-bold">Carteiras compatíveis</h2>
            <WalletStrip className="mt-3" />
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[15px]">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}

export function WalletStrip({ className }: { className?: string }) {
  return (
    <p className={`inline-flex items-center gap-3 rounded border border-kurio-line-2 bg-kurio-band px-2.5 py-1.5 text-[9px] font-bold tracking-[0.05em] text-primary ${className ?? ''}`}>
      <span>METAMASK</span>
      <span aria-hidden>•</span>
      <span>WALLETCONNECT</span>
      <span aria-hidden>•</span>
      <span>COINBASE</span>
    </p>
  )
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 flex flex-col items-start gap-2">{children}</div>
    </div>
  )
}

function NewsletterForm() {
  return (
    <form
      className="lg:border-l lg:border-primary lg:pl-4"
      onSubmit={(e) => {
        e.preventDefault()
        toast.info('A newsletter estará disponível em breve. Nenhum e-mail foi cadastrado.')
      }}
    >
      <h2 className="text-lg font-bold leading-4">Antecipe-se ao próximo lançamento</h2>
      <div className="mt-6 flex">
        <label htmlFor="newsletter-email" className="sr-only">
          Seu e-mail
        </label>
        <input
          id="newsletter-email"
          type="email"
          placeholder="digite seu e-mail..."
          className="h-10 min-w-0 flex-1 rounded-l bg-kurio-band px-3 text-[15px] placeholder:text-kurio-khaki focus:outline-2 focus:outline-primary"
        />
        <button type="submit" className="h-10 rounded-r bg-primary px-4 text-lg font-bold text-kurio-bg hover:bg-kurio-orange-light">
          Enviar
        </button>
      </div>
      <p className="mt-6 text-sm leading-[22px] text-kurio-khaki">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
    </form>
  )
}
