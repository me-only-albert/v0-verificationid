/**
 * Normalisasi nomor HP Indonesia ke format 62XXXXXXXXXX
 * Contoh:
 *   08123456789   -> 628123456789
 *   +628123456789 -> 628123456789
 *   628123456789  -> 628123456789
 *   8123456789    -> 628123456789
 */
export function normalizePhone(input: string): string {
  let phone = (input || "").replace(/[^\d+]/g, "")

  if (phone.startsWith("+")) phone = phone.slice(1)
  if (phone.startsWith("0")) phone = "62" + phone.slice(1)
  if (phone.startsWith("8")) phone = "62" + phone

  return phone
}

export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone)
  // Indonesia: 62 + 8xxxxxxxxx, total 10-15 digit
  return /^62\d{8,13}$/.test(normalized)
}
