"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, RotateCcw, Clock, Send } from "lucide-react"
import { Button } from "@/components/ui/button"

interface VerifyResultProps {
  code: string
  phone: string
  customerName: string
  expiresInMinutes: number
  expiresAt: number
  whatsappUrl: string
  outletName: string
  onReset: () => void
}

function formatPhoneForDisplay(phone: string) {
  if (!phone.startsWith("62")) return phone
  const rest = phone.slice(2)
  const groups = rest.match(/^(\d{3,4})(\d{3,4})(\d+)$/)
  if (!groups) return `+62 ${rest}`
  return `+62 ${groups[1]}-${groups[2]}-${groups[3]}`
}

export function VerifyResult({
  code,
  phone,
  customerName,
  expiresInMinutes,
  expiresAt,
  whatsappUrl,
  outletName,
  onReset,
}: VerifyResultProps) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)))
  const totalSeconds = expiresInMinutes * 60

  useEffect(() => {
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)))
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [expiresAt])

  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, "0")
  const ss = (secondsLeft % 60).toString().padStart(2, "0")
  const expired = secondsLeft <= 0
  const progress = Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100))

  return (
    <div className="flex flex-col gap-5">
      {/* Success header */}
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/30" aria-hidden="true" />
          <div className="relative flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <CheckCircle2 className="size-8" aria-hidden="true" />
          </div>
        </div>
        <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground text-balance">
          Halo, {customerName}.
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground text-pretty">
          Sebagai pelanggan setia MOX, Anda berhak menikmati promo spesial di{" "}
          <span className="font-semibold text-foreground">{outletName}</span>. Kirim kode ini ke WhatsApp outlet
          untuk menyelesaikan verifikasi.
        </p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-secondary/40 px-4 py-3 text-[13px]">
        <p className="text-muted-foreground">Member terverifikasi</p>
        <p className="mt-0.5 font-bold text-foreground">{customerName}</p>
        <p className="mt-0.5 text-muted-foreground">{formatPhoneForDisplay(phone)}</p>
      </div>

      {/* Code display */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-accent/[0.05] p-5">
        <div
          aria-hidden="true"
          className="absolute -right-8 -top-8 size-32 rounded-full bg-primary/10 blur-2xl"
        />

        <div className="relative flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Kode Klaim Promo Anda
          </span>

          <div
            className="mt-3 flex items-center gap-2 sm:gap-3"
            role="text"
            aria-label={`Kode verifikasi: ${code.split("").join(" ")}`}
          >
            {code.split("").map((digit, i) => (
              <div
                key={i}
                className="flex size-14 items-center justify-center rounded-2xl border border-primary/15 bg-card font-mono text-3xl font-bold text-foreground shadow-sm sm:size-16 sm:text-[34px]"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="animate-pop-in" style={{ animationDelay: `${i * 80}ms` }}>
                  {digit}
                </span>
              </div>
            ))}
          </div>

          {/* Timer */}
          <div className="mt-5 w-full">
            <div className="flex items-center justify-between text-[11px] font-medium">
              <span className={`flex items-center gap-1.5 ${expired ? "text-destructive" : "text-muted-foreground"}`}>
                <Clock className="size-3.5" aria-hidden="true" />
                {expired ? "Kode kedaluwarsa" : "Berlaku selama"}
              </span>
              {!expired && (
                <span className="font-mono font-bold text-foreground tabular-nums">
                  {mm}:{ss}
                </span>
              )}
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border/60">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                  expired ? "bg-destructive" : progress < 25 ? "bg-accent" : "bg-primary"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <p className="-mt-2 text-center text-[13px] font-semibold leading-relaxed text-destructive">
        Kode OTP wajib dikirim melalui WhatsApp. Jika tidak dikirim, kode tidak aktif.
      </p>

      {/* Actions */}
      <div className="flex flex-col gap-2.5">
        <Button
          asChild
          disabled={expired}
          className="h-12 rounded-2xl text-[14px] font-semibold shadow-lg shadow-primary/20"
        >
          <a href={expired ? undefined : whatsappUrl} target="_blank" rel="noopener noreferrer">
            <Send className="size-4" aria-hidden="true" />
            Kirim kode ke WhatsApp {outletName}
          </a>
        </Button>

        <Button
          onClick={onReset}
          variant="ghost"
          className="h-11 rounded-2xl text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Verifikasi nomor lain
        </Button>
      </div>
    </div>
  )
}
