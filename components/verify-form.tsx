"use client"

import { useState, useTransition } from "react"
import { Phone, Loader2, ShieldCheck, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotFoundModal } from "@/components/not-found-modal"
import { VerifyResult } from "@/components/verify-result"

type ApiResponse =
  | { ok: true; verificationCode: string; expiresInMinutes: number; phone: string }
  | { ok: false; code: "NOT_FOUND" | "INVALID" | "SERVER_ERROR" | "EXHAUSTED"; message: string }

export function VerifyForm() {
  const [phone, setPhone] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showNotFound, setShowNotFound] = useState(false)
  const [result, setResult] = useState<{ code: string; phone: string; expiresInMinutes: number } | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Hanya digit + maks panjang wajar
    const value = e.target.value.replace(/[^\d]/g, "").slice(0, 15)
    setPhone(value)
    if (error) setError(null)
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!phone.trim()) {
      setError("Nomor HP wajib diisi.")
      return
    }
    if (phone.length < 9) {
      setError("Nomor HP terlalu pendek.")
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        })
        const data: ApiResponse = await res.json()

        if (data.ok) {
          setResult({
            code: data.verificationCode,
            phone: data.phone,
            expiresInMinutes: data.expiresInMinutes,
          })
          return
        }

        if (data.code === "NOT_FOUND") {
          setShowNotFound(true)
          return
        }

        setError(data.message || "Terjadi kesalahan.")
      } catch {
        setError("Tidak bisa terhubung ke server. Periksa koneksi internet Anda.")
      }
    })
  }

  function reset() {
    setResult(null)
    setPhone("")
    setError(null)
  }

  if (result) {
    return (
      <VerifyResult code={result.code} phone={result.phone} expiresInMinutes={result.expiresInMinutes} onReset={reset} />
    )
  }

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="phone" className="text-sm font-semibold text-foreground">
            Nomor Handphone
          </label>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center gap-2 pl-4 pr-3 border-r border-border text-muted-foreground">
              <Phone className="size-4" aria-hidden="true" />
              <span className="text-sm font-medium">+62</span>
            </div>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="81234567890"
              value={phone}
              onChange={handleChange}
              disabled={pending}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "phone-error" : undefined}
              className="w-full h-14 rounded-xl bg-card border border-border pl-[5.5rem] pr-4 text-base font-medium tracking-wide outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            />
          </div>

          {error ? (
            <p id="phone-error" className="text-sm text-destructive font-medium">
              {error}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Contoh: 081234567890. Kami akan mengecek nomor Anda di database kami.
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={pending || !phone.trim()}
          className="h-14 rounded-xl text-base font-semibold gap-2 shadow-sm shadow-primary/25"
        >
          {pending ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              Memeriksa...
            </>
          ) : (
            <>
              Verifikasi Sekarang
              <ArrowRight className="size-5" aria-hidden="true" />
            </>
          )}
        </Button>

        <div className="flex items-start gap-3 rounded-xl bg-secondary/60 border border-border/60 p-3.5">
          <ShieldCheck className="size-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Data Anda aman. Nomor HP hanya digunakan untuk verifikasi dan tidak akan dibagikan ke pihak lain.
          </p>
        </div>
      </form>

      <NotFoundModal
        open={showNotFound}
        phone={phone}
        onOpenChange={setShowNotFound}
        onRetry={() => {
          setShowNotFound(false)
          setPhone("")
        }}
      />
    </>
  )
}
