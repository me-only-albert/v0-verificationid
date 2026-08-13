"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2, ArrowRight, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotFoundModal } from "@/components/not-found-modal"
import { VerifyResult } from "@/components/verify-result"

type ApiResponse =
  | {
      ok: true
      verificationCode: string
      expiresInMinutes: number
      phone: string
      customer: { code: string; name: string; mobilePhone: string }
      whatsappUrl: string
      outlet: { name: string; code: string; phone: string }
    }
  | {
      ok: false
      code:
        | "NOT_FOUND"
        | "INVALID"
        | "SERVER_ERROR"
        | "EXHAUSTED"
        | "OUTLET_NOT_FOUND"
        | "OUTLET_PHONE_EMPTY"
        | "DB_CONNECTION_ERROR"
        | "DB_QUERY_ERROR"
      message: string
    }

interface VerifyFormProps {
  outletCode?: string
}

type VerifyResultState = {
  code: string
  phone: string
  customerName: string
  expiresInMinutes: number
  expiresAt: number
  whatsappUrl: string
  outletName: string
}

function storageKey(outletCode: string) {
  return `mox-otp:${outletCode}`
}

export function VerifyForm({ outletCode = "" }: VerifyFormProps) {
  const [phone, setPhone] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showNotFound, setShowNotFound] = useState(false)
  const [result, setResult] = useState<VerifyResultState | null>(null)

  useEffect(() => {
    if (!outletCode.trim()) return

    try {
      const saved = window.localStorage.getItem(storageKey(outletCode))
      if (!saved) return

      const parsed = JSON.parse(saved) as VerifyResultState
      if (!parsed?.code || !parsed?.expiresAt || parsed.expiresAt <= Date.now()) {
        window.localStorage.removeItem(storageKey(outletCode))
        return
      }

      setResult(parsed)
      setPhone(parsed.phone)
    } catch {
      window.localStorage.removeItem(storageKey(outletCode))
    }
  }, [outletCode])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
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
    if (!outletCode.trim()) {
      setError("Silakan scan QR dari outlet terlebih dahulu.")
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, outletCode }),
        })
        const data: ApiResponse = await res.json()

        if (data.ok) {
          const nextResult: VerifyResultState = {
            code: data.verificationCode,
            phone: data.phone,
            customerName: data.customer.name,
            expiresInMinutes: data.expiresInMinutes,
            expiresAt: Date.now() + data.expiresInMinutes * 60 * 1000,
            whatsappUrl: data.whatsappUrl,
            outletName: data.outlet.name,
          }

          setResult(nextResult)
          window.localStorage.setItem(storageKey(outletCode), JSON.stringify(nextResult))
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
    if (outletCode.trim()) {
      window.localStorage.removeItem(storageKey(outletCode))
    }
  }

  if (result) {
    return (
      <VerifyResult
        code={result.code}
        phone={result.phone}
        customerName={result.customerName}
        expiresInMinutes={result.expiresInMinutes}
        expiresAt={result.expiresAt}
        whatsappUrl={result.whatsappUrl}
        outletName={result.outletName}
        onReset={reset}
      />
    )
  }

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-3">
          <label htmlFor="phone" className="flex items-center justify-between text-[16px] font-bold text-foreground">
            <span>Nomor HP Member</span>
            <span className="text-[12px] font-semibold text-muted-foreground">Wajib diisi</span>
          </label>

          <div
            className={`group relative flex items-stretch overflow-hidden rounded-2xl border-2 bg-card transition-all ${
              error
                ? "border-destructive/50 bg-destructive/[0.02]"
                : "border-border focus-within:border-primary focus-within:bg-primary/[0.015] focus-within:shadow-lg focus-within:shadow-primary/10"
            }`}
          >
            <div className="flex items-center gap-2 border-r border-border bg-secondary/50 pl-4 pr-3.5">
              <span className="text-base" aria-hidden="true">
                🇮🇩
              </span>
              <span className="text-[16px] font-bold text-foreground">+62</span>
            </div>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="812 3456 7890"
              value={phone}
              onChange={handleChange}
              disabled={pending}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "phone-error" : "phone-hint"}
              className="h-14 flex-1 bg-transparent px-4 text-[19px] font-bold tracking-wide text-foreground outline-none placeholder:font-semibold placeholder:text-muted-foreground/45 disabled:opacity-60"
            />
          </div>

          {error ? (
            <p
              id="phone-error"
              className="flex items-start gap-1.5 text-[14px] font-semibold text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : (
            <div id="phone-hint" className="rounded-2xl border border-accent/35 bg-accent/10 px-3.5 py-3">
              <p className="text-[14px] font-bold leading-relaxed text-foreground">
                Isi dengan nomor HP customer yang terdaftar sebagai member.
              </p>
              <p className="mt-1 text-[13px] font-semibold leading-relaxed text-muted-foreground">
                Bukan nomor kasir dan bukan nomor outlet. Contoh:{" "}
                <span className="text-foreground">081234567890</span> atau{" "}
                <span className="text-foreground">81234567890</span>.
              </p>
            </div>
          )}
        </div>

        <Button
          type="submit"
          disabled={pending || !phone.trim()}
          className="group relative h-14 overflow-hidden rounded-2xl text-[15px] font-semibold shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 active:scale-[0.99]"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {pending ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                Memeriksa nomor...
              </>
            ) : (
              <>
                Verifikasi Sekarang
                <ArrowRight
                  className="size-5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </>
            )}
          </span>
        </Button>
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
