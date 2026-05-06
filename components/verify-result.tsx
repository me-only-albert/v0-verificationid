"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Copy, Check, RotateCcw, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface VerifyResultProps {
  code: string
  phone: string
  expiresInMinutes: number
  onReset: () => void
}

function formatPhoneForDisplay(phone: string) {
  // 628123456789 -> +62 812-3456-789
  if (!phone.startsWith("62")) return phone
  const rest = phone.slice(2)
  const groups = rest.match(/^(\d{3,4})(\d{3,4})(\d+)$/)
  if (!groups) return `+62 ${rest}`
  return `+62 ${groups[1]}-${groups[2]}-${groups[3]}`
}

export function VerifyResult({ code, phone, expiresInMinutes, onReset }: VerifyResultProps) {
  const [copied, setCopied] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(expiresInMinutes * 60)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [secondsLeft])

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // ignore
    }
  }

  const mm = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, "0")
  const ss = (secondsLeft % 60).toString().padStart(2, "0")
  const expired = secondsLeft <= 0

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center text-center gap-2">
        <div className="flex items-center justify-center size-14 rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-foreground text-balance">Verifikasi Berhasil</h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Nomor <span className="font-semibold text-foreground">{formatPhoneForDisplay(phone)}</span> terdaftar. Berikut
          kode verifikasi Anda:
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-gradient-to-b from-primary/5 to-card p-6 flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Kode Verifikasi
        </div>

        <div
          className="flex items-center gap-2 sm:gap-3 font-mono"
          role="text"
          aria-label={`Kode verifikasi: ${code.split("").join(" ")}`}
        >
          {code.split("").map((digit, i) => (
            <div
              key={i}
              className="flex items-center justify-center size-14 sm:size-16 rounded-xl bg-card border-2 border-primary/30 text-2xl sm:text-3xl font-bold text-primary shadow-sm"
            >
              {digit}
            </div>
          ))}
        </div>

        <div
          className={`flex items-center gap-1.5 text-xs font-medium ${
            expired ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          <Clock className="size-3.5" aria-hidden="true" />
          {expired ? (
            <span>Kode sudah kedaluwarsa</span>
          ) : (
            <span>
              Berlaku {mm}:{ss}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <Button onClick={copyCode} variant="secondary" className="h-12 rounded-xl text-sm font-semibold gap-2">
          {copied ? (
            <>
              <Check className="size-4" aria-hidden="true" />
              Tersalin
            </>
          ) : (
            <>
              <Copy className="size-4" aria-hidden="true" />
              Salin Kode
            </>
          )}
        </Button>

        <Button onClick={onReset} variant="ghost" className="h-12 rounded-xl text-sm font-medium gap-2">
          <RotateCcw className="size-4" aria-hidden="true" />
          Verifikasi Nomor Lain
        </Button>
      </div>
    </div>
  )
}
