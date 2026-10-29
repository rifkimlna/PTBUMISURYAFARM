export const DOKUMEN_PENJUALAN_STATUS_SAH = ["TERBUKA", "LUNAS"] as const;
export type DokumenPenjualanStatusSah = typeof DOKUMEN_PENJUALAN_STATUS_SAH[number];

/**
 * Cek apakah DokumenPenjualan tipe PENAGIHAN dianggap sah untuk piutang/pendapatan/jurnal.
 * Dipakai oleh Neraca, Jurnal, dan Laba Rugi agar aturan sama.
 */
export function isDokumenPenjualanSah(dok: { tipe?: string; status?: string | null } | null | undefined): boolean {
  if (!dok) return false;
  return dok.tipe === "PENAGIHAN" && (dok.status ? DOKUMEN_PENJUALAN_STATUS_SAH.includes(dok.status as any) : false);
}
