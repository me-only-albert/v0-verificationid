"use client"

import { useState, useTransition } from "react"
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

export function VerifyForm({ outletCode = "" }: VerifyFormProps) {
  const [phone, setPhone] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showNotFound, setShowNotFound] = useState(false)
  const [result, setResult] = useState<{
    code: string
    phone: string
    customerName: string
    expiresInMinutes: number
    whatsappUrl: string
    outletName: string
  } | null>(null)

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
          setResult({
            code: data.verificationCode,
            phone: data.phone,
            customerName: data.customer.name,
            expiresInMinutes: data.expiresInMinutes,
            whatsappUrl: data.whatsappUrl,
            outletName: data.outlet.name,
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
      <VerifyResult
        code={result.code}
        phone={result.phone}
        customerName={result.customerName}
        expiresInMinutes={result.expiresInMinutes}
        whatsappUrl={result.whatsappUrl}
        outletName={result.outletName}
        onReset={reset}
      />
    )
  }

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="phone" className="flex items-center justify-between text-[13px] font-semibold text-foreground">
            <span>Nomor Handphone</span>
            <span className="text-[11px] font-medium text-muted-foreground">Wajib diisi</span>
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
              <span className="text-[15px] font-semibold text-foreground">+62</span>
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
              className="h-14 flex-1 bg-transparent px-4 text-[17px] font-semibold tracking-wide text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/50 disabled:opacity-60"
            />
          </div>

          {error ? (
            <p
              id="phone-error"
              className="flex items-start gap-1.5 text-[13px] font-medium text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : (
            <p id="phone-hint" className="text-[12px] leading-relaxed text-muted-foreground">
              Contoh: <span className="font-medium text-foreground">081234567890</span> atau{" "}
              <span className="font-medium text-foreground">81234567890</span>
            </p>
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
