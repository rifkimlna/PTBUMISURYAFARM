// Aturan pembeda akun non-laba-rugi untuk modul Anggaran Laba Rugi.
// Sumber pembeda: TAG transaksi kas (TERIMA_PIUTANG / BAYAR_UTANG) yang sudah
// dipakai modul Biaya, Arus Kas, Laba Rugi, dan Jurnal.
// TIDAK ada daftar kode akun: kode COA boleh berubah/berurutan ulang.

export const TAG_TERIMA_PIUTANG = "TERIMA_PIUTANG";
export const TAG_BAYAR_UTANG = "BAYAR_UTANG";

/** Tag transaksi kas yang menandai mutasi kas (bukan pendapatan/beban). */
export const TAG_NON_LABA_RUGI: readonly string[] = [TAG_TERIMA_PIUTANG, TAG_BAYAR_UTANG];

/** Satu fungsi bersama: apakah tag menyatakan akun non-laba-rugi? */
export function isNonLabaRugiTag(tag: string | null | undefined): boolean {
  if (!tag) return false;
  return TAG_NON_LABA_RUGI.includes(tag.trim().toUpperCase());
}
