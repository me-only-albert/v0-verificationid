"use client"

import { AlertCircle, RefreshCw, HelpCircle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface NotFoundModalProps {
  open: boolean
  phone: string
  onOpenChange: (open: boolean) => void
  onRetry: () => void
}

export function NotFoundModal({ open, phone, onOpenChange, onRetry }: NotFoundModalProps) {
  const displayPhone = phone ? `+62${phone.replace(/^0/, "").replace(/^62/, "")}` : ""

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-3xl border-border/70 p-0 sm:max-w-md">
        {/* Header band */}
        <div className="relative bg-gradient-to-br from-destructive/10 via-destructive/5 to-card px-6 pb-5 pt-7">
          <div
            aria-hidden="true"
            className="absolute -right-6 -top-6 size-24 rounded-full bg-destructive/15 blur-2xl"
          />
          <div className="relative flex flex-col items-center gap-3 text-center">
            <div className="relative flex size-14 items-center justify-center rounded-2xl bg-destructive text-destructive-foreground shadow-lg shadow-destructive/25">
              <AlertCircle className="size-7" aria-hidden="true" />
            </div>
            <AlertDialogHeader className="gap-1.5">
              <AlertDialogTitle className="text-center text-lg font-bold tracking-tight text-balance">
                Nomor Tidak Terdaftar
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-[13px] leading-relaxed text-pretty">
                {displayPhone ? (
                  <>
                    Nomor{" "}
                    <span className="font-semibold text-foreground">{displayPhone}</span> belum
                    terdaftar pada sistem kami.
                  </>
                ) : (
                  "Nomor yang Anda masukkan belum terdaftar."
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 pt-4">
          <div className="rounded-2xl border border-border bg-secondary/40 p-3.5">
            <div className="flex items-start gap-2.5">
              <HelpCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="flex flex-col gap-1 text-[12px] leading-relaxed text-muted-foreground">
                <p className="font-semibold text-foreground">Yang bisa Anda lakukan:</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  <li>Pastikan nomor tidak ada salah ketik</li>
                  <li>Coba gunakan format tanpa angka 0 di depan</li>
                  <li>Hubungi admin jika nomor seharusnya terdaftar</li>
                </ul>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="mt-4 flex-col gap-2 sm:flex-col sm:space-x-0">
            <AlertDialogAction
              onClick={onRetry}
              className="h-12 w-full rounded-2xl text-[14px] font-semibold shadow-lg shadow-primary/20"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Coba Nomor Lain
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
