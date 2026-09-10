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
