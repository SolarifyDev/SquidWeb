import squidLogo from 'assets/squid-logo.png'

export default function RunbookEmptyIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'relative h-20 w-32' : 'relative h-48 w-64'} aria-hidden="true">
      <div className="absolute inset-[12%_8%_18%_12%] rotate-[-8deg] rounded-[48%_52%_44%_56%] bg-[#36506d]" />
      <div className="absolute inset-[24%_20%_26%_24%] rotate-[7deg] rounded-[55%_45%_61%_39%] bg-[#29425f]" />
      <div className={compact ? 'absolute left-[42%] top-[30%] h-9 w-9' : 'absolute left-[40%] top-[31%] h-24 w-24'}>
        <img src={squidLogo} alt="" className="h-full w-full object-contain" />
      </div>
    </div>
  )
}
