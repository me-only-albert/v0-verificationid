import { ShieldCheck } from "lucide-react"
import { VerifyForm } from "@/components/verify-form"

export default function Page() {
  return (
    <main className="min-h-dvh bg-background flex flex-col">
      {/* Hero / branding section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/85 text-primary-foreground">
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          aria-hidden="true"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="relative mx-auto w-full max-w-md px-5 pt-10 pb-16 sm:pt-14 sm:pb-20">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground/80">
            <span className="inline-flex size-1.5 rounded-full bg-accent" />
            Sistem Verifikasi
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold leading-tight text-balance">
            Verifikasi Nomor Handphone
          </h1>
          <p className="mt-2 text-sm sm:text-base text-primary-foreground/85 leading-relaxed text-pretty">
            Masukkan nomor HP Anda untuk mendapatkan kode unik 4 digit.
          </p>
        </div>
      </section>

      {/* Form card – overlap dengan hero untuk look yang ringkas di mobile */}
      <section className="flex-1 -mt-10 sm:-mt-12 px-5 pb-10">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl bg-card border border-border shadow-xl shadow-primary/5 p-5 sm:p-6">
            <VerifyForm />
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Dilindungi sistem verifikasi internal
          </p>
        </div>
      </section>
    </main>
  )
}
