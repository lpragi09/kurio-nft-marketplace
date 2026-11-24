import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Search } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { NftImage } from '@/components/kurio/nft-image'
import { ComingSoon } from '@/components/kurio/coming-soon'
import { Catalog } from '@/features/catalog/catalog'

const SLIDES = [
  { art: '/nfts/emerald-ape', alt: 'Emerald Ape #042: macaco com óculos redondos verdes e jaqueta college verde', title: ['SEJA DONO DO FUTURO', 'DA ARTE DIGITAL'] },
  { art: '/nfts/ivory-baron', alt: 'Ivory Baron #088: gorila de blazer marfim e gola alta verde', title: ['COLECIONE EDIÇÕES', 'RARAS E VERIFICADAS'] },
  { art: '/nfts/golden-beat', alt: 'Golden Beat #207: orangotango dourado com fones verdes', title: ['APOIE ARTISTAS', 'E CRIADORES'] },
]

export function HomePage() {
  return (
    <>
      <MobileHomeTop />
      <Hero />
      <Catalog />
      <Promos />
      <Journal />
    </>
  )
}

function Hero() {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]!
  return (
    <section aria-roledescription="carrossel" aria-label="Destaques" className="mx-auto hidden max-w-[1200px] grid-cols-[1fr_450px] gap-10 px-6 pt-8 md:grid xl:px-0">
      <div className="relative flex flex-col justify-center pl-0 lg:pl-10" aria-live="polite">
        <p className="text-[15px] font-medium tracking-[0.1em]">Bem-vindo à Kurio</p>
        <h1 className="mt-4 text-[34px] font-bold leading-[54px] tracking-[0.05em] lg:text-[43px] lg:leading-[70px]">
          {slide.title[0]}
          <br />
          {slide.title[1]}
        </h1>
        <p className="mt-4 max-w-[560px] text-[14px] leading-6 tracking-[0.05em] text-kurio-sand">
          Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.
        </p>
        <Link to="/" hash="catalogo" className="mt-8 inline-flex h-10 w-[140px] items-center justify-center rounded bg-primary text-[16px] font-bold text-kurio-bg hover:bg-kurio-orange-light">
          EXPLORAR
        </Link>
        <div className="absolute bottom-8 right-0 flex" role="group" aria-label="Escolher destaque">
          {SLIDES.map((s, i) => (
            <button
              key={s.art}
              type="button"
              aria-label={`Destaque ${i + 1} de ${SLIDES.length}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className="group grid size-6 place-items-center rounded-full"
            >
              <span aria-hidden className={cn('size-2 rounded-full bg-primary transition', i === index ? 'scale-125' : 'opacity-70 group-hover:opacity-100')} />
            </button>
          ))}
        </div>
      </div>
      <div className="aspect-square overflow-hidden rounded-[16px]">
        <NftImage base={slide.art} alt={slide.alt} priority sizes="450px" />
      </div>
    </section>
  )
}

function MobileHomeTop() {
  const navigate = useNavigate({ from: '/' })
  const [q, setQ] = useState('')
  return (
    <div className="px-6 pt-6 md:hidden">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          void navigate({ search: (prev) => ({ ...prev, q: q.trim() || undefined, pagina: undefined }), hash: 'catalogo' })
        }}
        className="relative"
      >
        <label htmlFor="mobile-search" className="sr-only">
          Explorar coleções
        </label>
        <Search className="pointer-events-none absolute left-3 top-3 size-5 text-kurio-sand" aria-hidden />
        <input
          id="mobile-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Explorar coleções"
          className="h-11 w-full rounded-[10px] bg-kurio-surface-2 pl-10 pr-3 text-[15px] placeholder:text-kurio-sand focus:outline-2 focus:outline-primary"
        />
      </form>
      <section aria-label="Destaque" className="relative mt-4 overflow-hidden rounded-[29px] bg-gradient-to-br from-[#7a5634] via-kurio-surface-2 to-kurio-surface p-4">
        <div className="relative z-10 max-w-[55%]">
          <p className="text-[12px] font-medium">Bem-vindo à Kurio</p>
          <h1 className="mt-2 text-[16px] font-bold leading-7 tracking-[0.05em]">
            SEJA DONO DA
            <br />
            CULTURA DIGITAL
          </h1>
          <p className="mt-1 text-[11px] leading-4 text-kurio-sand">Descubra NFTs selecionados de criadores do mundo todo.</p>
          <Link to="/" hash="catalogo" className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-primary">
            EXPLORAR <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <div className="absolute right-4 top-3 w-[138px]">
          <NftImage base="/nfts/emerald-ape" alt="" decorative priority sizes="138px" className="rounded-[16px]" />
        </div>
      </section>
    </div>
  )
}

function Promos() {
  const items = [
    { art: '/nfts/emerald-ape', title: 'Lançamentos gênesis de edição limitada', text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.', search: { aba: 'novos' as const } },
    { art: '/nfts/ivory-baron', title: 'Arte digital selecionada e muito mais', text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.', search: { cat: 'arte-digital' } },
  ]
  return (
    <section aria-label="Coleções em destaque" className="mx-auto mt-24 grid max-w-[1200px] gap-6 px-6 md:grid-cols-2 xl:px-0">
      {items.map((p) => (
        <article key={p.title} className="grid grid-cols-[1fr_1fr] overflow-hidden rounded-[16px] bg-kurio-surface">
          <NftImage base={p.art} alt="" decorative className="h-full rounded-[16px]" sizes="290px" />
          <div className="flex flex-col items-end justify-center gap-3 p-4 text-right">
            <h2 className="text-[15px] font-bold leading-6 md:text-[18px]">{p.title}</h2>
            <p className="text-[13px] leading-6 text-kurio-sand md:text-[14px]">{p.text}</p>
            <Link to="/" search={p.search} hash="catalogo" className="inline-flex h-10 items-center gap-1 rounded bg-primary px-6 text-[14px] font-bold text-kurio-bg hover:bg-kurio-orange-light">
              Explorar <ArrowRight className="size-4" aria-hidden />
              <span className="sr-only">: {p.title}</span>
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  { art: '/nfts/ivory-baron', date: '12 de setembro', read: 6, title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.' },
  { art: '/nfts/emerald-ape', date: '13 de setembro', read: 2, title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.' },
  { art: '/nfts/sage-nomad', date: '15 de setembro', read: 3, title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.' },
  { art: '/nfts/golden-beat', date: '15 de setembro', read: 2, title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.' },
]

function Journal() {
  return (
    <section aria-labelledby="diario" className="mx-auto mt-24 max-w-[1200px] px-6 xl:px-0">
      <h2 id="diario" className="text-center text-[24px] font-bold md:text-[28px]">
        Diário da Cunhagem
      </h2>
      <p className="mt-4 text-center text-[14px] text-kurio-sand">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((p) => (
          <article key={p.title} className="overflow-hidden rounded-[8px] bg-kurio-surface">
            <div className="aspect-[268/230] overflow-hidden">
              <NftImage base={p.art} alt="" decorative className="h-full" sizes="(min-width:1024px) 268px, 50vw" />
            </div>
            <div className="space-y-2 p-4">
              <p className="text-[12px] text-kurio-sand">
                {p.date} <span aria-hidden>|</span> Leitura de {p.read} min
              </p>
              <h3 className="text-[16px] font-bold leading-5">{p.title}</h3>
              <p className="text-[12px] leading-4 text-kurio-sand">{p.text}</p>
              <ComingSoon className="text-[12px] font-bold text-primary" label="O Diário da Cunhagem">
                Ler mais →
              </ComingSoon>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
