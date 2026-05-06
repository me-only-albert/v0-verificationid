"use client"

import { AlertCircle } from "lucide-react"
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
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md rounded-2xl gap-4">
        <AlertDialogHeader className="items-center text-center gap-3">
          <div className="flex items-center justify-center size-14 rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-7" aria-hidden="true" />
          </div>
          <AlertDialogTitle className="text-xl text-balance">Nomor Tidak Terdaftar</AlertDialogTitle>
          <AlertDialogDescription className="text-pretty leading-relaxed">
            {phone ? (
              <>
                Nomor <span className="font-semibold text-foreground">+62{phone.replace(/^0/, "")}</span> tidak kami
                temukan di database. Pastikan nomor yang Anda masukkan sudah benar.
              </>
            ) : (
              "Nomor yang Anda masukkan tidak ditemukan di database kami."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogAction onClick={onRetry} className="h-12 rounded-xl w-full sm:w-auto sm:px-8 font-semibold">
            Coba Lagi
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
