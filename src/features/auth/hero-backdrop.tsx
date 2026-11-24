import { NftImage } from '@/components/kurio/nft-image'

/** Static home hero rendered behind the login/register dialog (as in the Figma frames). */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="mx-auto hidden max-w-[1200px] grid-cols-[1fr_450px] gap-10 px-6 pt-8 md:grid xl:px-0">
      <div className="flex flex-col justify-center lg:pl-10">
        <p className="text-[15px] font-medium tracking-[0.1em]">Bem-vindo à Kurio</p>
        <p className="mt-4 text-[34px] font-bold leading-[54px] tracking-[0.05em] lg:text-[43px] lg:leading-[70px]">
          SEJA DONO DO FUTURO
          <br />
          DA ARTE DIGITAL
        </p>
        <p className="mt-4 max-w-[560px] text-[14px] leading-6 text-kurio-sand">Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital verificada.</p>
        <span className="mt-8 inline-flex h-10 w-[140px] items-center justify-center rounded bg-primary font-bold text-kurio-bg">EXPLORAR</span>
      </div>
      <div className="overflow-hidden rounded-[16px]">
        <NftImage base="/nfts/emerald-ape" alt="" decorative priority sizes="450px" />
      </div>
    </div>
  )
}
