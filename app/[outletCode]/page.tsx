import { Gift, Phone, ShieldCheck } from "lucide-react"
import { notFound } from "next/navigation"
import { VerifyForm } from "@/components/verify-form"
import { getOutletByCode } from "@/lib/outlets"

interface OutletPageProps {
  params: Promise<{ outletCode: string }>
}

function formatPhone(phone: string) {
  if (!phone.startsWith("62")) return phone
  return `+62 ${phone.slice(2)}`
}

export default async function OutletPage({ params }: OutletPageProps) {
  const { outletCode } = await params
  const outlet = await getOutletByCode(decodeURIComponent(outletCode))

  if (!outlet) {
    notFound()
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-24 size-72 rounded-full bg-primary/15 blur-3xl animate-float-slow" />
        <div
          className="absolute top-40 -left-24 size-64 rounded-full bg-accent/20 blur-3xl animate-float-slow"
          style={{ animationDelay: "1.5s" }}
        />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8 sm:py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-foreground">MOX VerifyID</span>
              <span className="text-[11px] font-medium text-muted-foreground">Verifikasi Diskon Member</span>
            </div>
          </div>
        </header>

        <section className="mt-10 animate-pop-in">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent-foreground">
            <Gift className="size-3" aria-hidden="true" />
            Klaim Promo Spesial
          </span>
          <h1 className="mt-4 text-[28px] font-bold leading-[1.15] tracking-tight text-foreground text-balance">
            Verifikasi diskon di <span className="text-primary">{outlet.outletName}</span>
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground text-pretty">
            Masukkan nomor HP member Anda untuk mendapatkan kode OTP, lalu kirimkan kode tersebut ke WhatsApp outlet.
          </p>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm">
              <Phone className="size-4" aria-hidden="true" />
            </div>
            <div className="flex-1 leading-snug">
              <p className="text-[13px] font-bold text-foreground">{outlet.outletName}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                WhatsApp outlet: <span className="font-semibold text-foreground">{formatPhone(outlet.phone)}</span>
              </p>
            </div>
          </div>
        </section>

        <section className="mt-7 animate-pop-in" style={{ animationDelay: "0.1s" }}>
          <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-xl shadow-primary/[0.06] sm:p-6">
            <VerifyForm outletCode={outletCode} />
          </div>
        </section>

        <footer className="mt-auto flex flex-col items-center gap-1 pt-8 text-center">
          <p className="text-[12px] font-semibold text-foreground">
            Supported by{" "}
            <a
              href="https://daintypos.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary transition-all hover:underline active:opacity-75"
            >
              DaintyPOS
            </a>
          </p>
          <p className="text-[11px] text-muted-foreground">Sistem verifikasi internal</p>
        </footer>
      </div>
    </main>
  )
}
