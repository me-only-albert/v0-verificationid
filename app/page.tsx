import { ShieldCheck, Lock, Zap, Gift, Sparkles } from "lucide-react"
import { VerifyForm } from "@/components/verify-form"

export default function Page() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      {/* Decorative background — subtle, mobile-aware */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-24 size-72 rounded-full bg-primary/15 blur-3xl animate-float-slow" />
        <div
          className="absolute top-40 -left-24 size-64 rounded-full bg-accent/20 blur-3xl animate-float-slow"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "24px 24px",
            color: "var(--foreground)",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8 sm:py-10">
        {/* Brand row */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <ShieldCheck className="size-5" aria-hidden="true" />
              <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-accent ring-2 ring-background" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-foreground">VerifyID</span>
              <span className="text-[11px] font-medium text-muted-foreground">Verifikasi Aman</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary">
            <span className="relative flex size-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
              <span className="relative size-1.5 rounded-full bg-primary" />
            </span>
            Online
          </span>
        </header>

        {/* Hero */}
        <section className="mt-10 sm:mt-12 animate-pop-in">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent-foreground">
            <Gift className="size-3" aria-hidden="true" />
            Klaim Promo Spesial
          </span>
          <h1 className="mt-4 text-[28px] sm:text-[32px] font-bold leading-[1.15] tracking-tight text-foreground text-balance">
            Verifikasi nomor HP untuk{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-primary">klaim promo</span>
              <span className="absolute inset-x-0 bottom-1 z-0 h-2.5 bg-accent/40" aria-hidden="true" />
            </span>{" "}
            Anda.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground text-pretty">
            Masukkan nomor handphone Anda di bawah ini untuk mendapatkan{" "}
            <span className="font-semibold text-foreground">kode unik 4 digit</span> sebagai bukti
            klaim promo Anda.
          </p>

          {/* Promo info card */}
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/15 via-accent/5 to-transparent p-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm">
              <Sparkles className="size-4" aria-hidden="true" />
            </div>
            <div className="flex-1 leading-snug">
              <p className="text-[13px] font-bold text-foreground">Cara klaim promo Anda</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground text-pretty">
                Tunjukkan kode 4 digit yang muncul ke kasir kami untuk menikmati promo spesial.
              </p>
            </div>
          </div>
        </section>

        {/* Form card */}
        <section className="mt-7 animate-pop-in" style={{ animationDelay: "0.1s" }}>
          <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-xl shadow-primary/[0.06] sm:p-6">
            <VerifyForm />
          </div>
        </section>

        {/* Trust strip */}
        <section
          className="mt-6 grid grid-cols-3 gap-2 animate-pop-in"
          style={{ animationDelay: "0.2s" }}
        >
          <TrustItem icon={Lock} label="Terenkripsi" />
          <TrustItem icon={ShieldCheck} label="Data Aman" />
          <TrustItem icon={Zap} label="Real-time" />
        </section>

        <footer className="mt-auto flex flex-col items-center gap-1 pt-8 text-center">
          <p className="text-[12px] font-semibold text-foreground">
            by <span className="text-primary">Dainty Pos</span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            &copy; {new Date().getFullYear()} VerifyID &middot; Sistem verifikasi internal
          </p>
        </footer>
      </div>
    </main>
  )
}

function TrustItem({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>
  label: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card/60 px-2 py-3 backdrop-blur-sm">
      <Icon className="size-4 text-primary" aria-hidden="true" />
      <span className="text-[11px] font-semibold text-foreground">{label}</span>
    </div>
  )
}
