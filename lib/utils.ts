import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format angka menjadi format rupiah dengan pemisah ribuan berupa titik.
// Contoh: 7500000 -> "7.500.000"
export function formatRupiah(value: number | string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return "0";
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// URL foto palsu dari mode simulated lama tidak bisa dibuka — anggap tidak ada foto.
export function isRealFotoUrl(url?: string | null): url is string {
  if (!url) return false;
  if (url.includes("storage.pt-bst.example")) return false;
  return true;
}

// Format rupiah ringkas untuk label sumbu grafik.
export function formatRupiahCompact(value: number | string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return "Rp 0";
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) {
    return `Rp ${(num / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  }
  if (abs >= 1_000_000) {
    return `Rp ${(num / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  }
  if (abs >= 1_000) {
    return `Rp ${(num / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  }
  return `Rp ${Math.round(num).toString()}`;
}
