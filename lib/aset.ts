// Domain Aset Tetap PT Bumi Surya Farm - sumber tunggal kategori & status.
// Lifecycle aset (kolom statusAset): TERTUNDA -> AKTIF -> DIJUAL/DILEPAS.
// Kolom lama `status` (Aktif/Tidak Digunakan/...) dipertahankan apa adanya
// untuk data lama dan tidak lagi dipakai alur baru.
export const KATEGORI_ASET = [
  "Tanah",
  "Bangunan & Instalasi",
  "Mesin & Peralatan Pertanian/Peternakan",
  "Perabotan & Peralatan Kantor/Villa",
  "Tanaman Produktif",
  "Ternak",
  "Ikan Budidaya",
] as const;

export const STATUS_ASET = [
  "Aktif",
  "Tidak Digunakan",
  "Dipinjamkan",
  "Dijual",
  "Dihapus",
] as const;

export type KategoriAset = (typeof KATEGORI_ASET)[number];
export type StatusAset = (typeof STATUS_ASET)[number];

export const STATUS_ASET_LIFECYCLE = ["TERTUNDA", "AKTIF", "DIJUAL", "DILEPAS"] as const;
export type StatusAsetLifecycle = (typeof STATUS_ASET_LIFECYCLE)[number];

export const METODE_SUSUT = ["GARIS_LURUS", "SALDO_MENURUN"] as const;
export type MetodeSusut = (typeof METODE_SUSUT)[number];

export const METODE_SUSUT_LABEL: Record<string, string> = {
  NON_DEP: "Non-depresiasi",
  GARIS_LURUS: "Garis Lurus",
  SALDO_MENURUN: "Saldo Menurun",
};

// Kas & setara untuk Akun Dikreditkan (tunai) -> SumberDana TransaksiKas.
export const SUMBER_DANA_BY_KODE_AKUN: Record<string, "KAS" | "BANK" | "TABUNGAN"> = {
  "1101": "KAS",
  "1103": "BANK",
  "1104": "TABUNGAN",
};

function awalBulan(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Bulan berjalan yang sudah dilalui sejak mulai (inklusif), 0 bila belum mulai.
export function bulanBerjalanSejak(mulai: Date, sekarang: Date = new Date()): number {
  const a = awalBulan(mulai);
  const b = awalBulan(sekarang);
  const diff = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
  return Math.max(0, diff);
}

export type HasilSusut = {
  perBulan: number;
  akumulasi: number;
  nilaiBuku: number;
  selesai: boolean;
};

// Hitung penyusutan s/d akhir bulan berjalan. Semua rupiah dibulatkan.
// Tanpa akun akumulasi di COA, hasil ini informatif (belum dijurnal otomatis).
export function hitungSusut(
  biaya: number,
  nilaiResidu: number,
  masaBulan: number,
  metode: string | null | undefined,
  tanggalMulai: Date | null | undefined,
  sekarang: Date = new Date()
): HasilSusut {
  const dapatDisusutkan = Math.max(0, Math.round(biaya - Math.max(0, nilaiResidu)));
  if (
    !metode ||
    metode === "NON_DEP" ||
    masaBulan <= 0 ||
    !tanggalMulai ||
    Number.isNaN(new Date(tanggalMulai).getTime()) ||
    dapatDisusutkan <= 0
  ) {
    return { perBulan: 0, akumulasi: 0, nilaiBuku: Math.round(biaya), selesai: metode === "NON_DEP" };
  }
  const elapsed = bulanBerjalanSejak(new Date(tanggalMulai), sekarang);
  if (elapsed <= 0) {
    return { perBulan: 0, akumulasi: 0, nilaiBuku: Math.round(biaya), selesai: false };
  }
  if (metode === "SALDO_MENURUN") {
    const rate = 2 / masaBulan;
    const akumSampai = (n: number) => {
      let book = biaya;
      let akum = 0;
      for (let i = 0; i < n; i++) {
        if (book <= nilaiResidu) break;
        const depBulat = Math.max(0, Math.round(Math.min(book * rate, book - nilaiResidu)));
        if (depBulat <= 0) break;
        akum += depBulat;
        book -= depBulat;
      }
      return Math.min(akum, dapatDisusutkan);
    };
    const akum = akumSampai(elapsed);
    const bulanIni = akum - akumSampai(elapsed - 1);
    return { perBulan: bulanIni, akumulasi: akum, nilaiBuku: Math.round(biaya - akum), selesai: akum >= dapatDisusutkan };
  }
  // GARIS_LURUS (default)
  const perBulan = dapatDisusutkan / masaBulan;
  const akum = Math.min(Math.round(perBulan * Math.min(elapsed, masaBulan)), dapatDisusutkan);
  return {
    perBulan: Math.round(perBulan),
    akumulasi: akum,
    nilaiBuku: Math.round(biaya - akum),
    selesai: elapsed >= masaBulan,
  };
}