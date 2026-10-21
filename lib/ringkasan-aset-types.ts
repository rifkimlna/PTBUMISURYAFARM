// Tipe & konstanta Laporan Ringkasan Aset Tetap (aman untuk Client Component).
// Tanpa impor server/prisma.
//
// Laporan ini adalah laporan posisi aset tetap pada tanggal akhir periode:
// - Hanya aset yang aktif pada tanggal akhir laporan yang ditampilkan.
// - Aset TERTUNDA, serta aset yang sudah DIJUAL/DILEPAS pada atau sebelum
//   tanggal akhir laporan, tidak dihitung sebagai aset aktif.
// - Biaya Awal = biaya akuisisi (fallback nilai aset × jumlah untuk data lama).
// - Akumulasi Penyusutan memakai hitungSusut() yang sama dengan halaman Aset.
// - Nilai Buku = Biaya Awal - Akumulasi Penyusutan.
// Tidak ada data dummy dan tidak membuat jurnal otomatis.

export const RINGKASAN_ASET_PERIODE = [
  "hari-ini",
  "minggu-ini",
  "bulan-ini",
  "kuartal-ini",
  "tahun-ini",
  "kemarin",
  "minggu-lalu",
  "bulan-lalu",
  "kuartal-lalu",
  "tahun-lalu",
  "custom",
] as const;

export type RingkasanAsetPeriode = (typeof RINGKASAN_ASET_PERIODE)[number];

export const RINGKASAN_ASET_PERIODE_LABEL: Record<RingkasanAsetPeriode, string> = {
  "hari-ini": "Hari ini",
  "minggu-ini": "Minggu ini",
  "bulan-ini": "Bulan ini",
  "kuartal-ini": "Kuartal ini",
  "tahun-ini": "Tahun ini",
  kemarin: "Kemarin",
  "minggu-lalu": "Minggu lalu",
  "bulan-lalu": "Bulan lalu",
  "kuartal-lalu": "Kuartal lalu",
  "tahun-lalu": "Tahun lalu",
  custom: "Custom",
};

export type RingkasanAsetBaris = {
  /** Nomor aset (id Aset, ex: AST-001). */
  nomorAset: string;
  namaAset: string;
  /** Tanggal akuisisi (fallback tanggal perolehan); null bila tidak tercatat. */
  tanggalAkuisisi: string | null;
  kategori: string;
  /** Kode akun aset tetap yang dipakai sebagai kelompok. */
  akunAset: string;
  akunNama: string;
  /** Biaya Awal (Rupiah, dibulatkan). */
  biayaAwal: number;
  /** Akumulasi penyusutan s/d tanggal akhir laporan. */
  akumulasiPenyusutan: number;
  /** Biaya Awal - Akumulasi Penyusutan. */
  nilaiBuku: number;
  metodeSusut: string | null;
};

export type RingkasanAsetKelompok = {
  /** Kode akun aset (atau "(tanpa akun)" bila tidak ada). */
  kode: string;
  nama: string;
  baris: RingkasanAsetBaris[];
  subtotalBiayaAwal: number;
  subtotalAkumulasiPenyusutan: number;
  subtotalNilaiBuku: number;
};

export type RingkasanAsetSnapshot = {
  periode: RingkasanAsetPeriode;
  /** Awal periode (ISO). */
  start: string;
  /** Tanggal akhir laporan, akhir hari (ISO). */
  end: string;
  /** Label cetak, ex: "Periode 1 Oktober 2026 - 31 Oktober 2026". */
  label: string;
  kelompok: RingkasanAsetKelompok[];
  totalAset: number;
  totalBiayaAwal: number;
  totalAkumulasiPenyusutan: number;
  totalNilaiBuku: number;
  catatan: string[];
};

// ----------------------------------------------------------------------------
// Helper periode (murni, aman di client)
// ----------------------------------------------------------------------------

function startOfDayLokal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDaysLokal(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function parseYMD(value?: string): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Awal periode untuk preset. */
export function awalUntukRingkasanAset(periode: RingkasanAsetPeriode, now = new Date()): Date {
  const today = startOfDayLokal(now);
  switch (periode) {
    case "hari-ini":
      return today;
    case "kemarin":
      return addDaysLokal(today, -1);
    case "minggu-ini": {
      const dow = (today.getDay() + 6) % 7;
      return addDaysLokal(today, -dow);
    }
    case "minggu-lalu": {
      const dow = (today.getDay() + 6) % 7;
      return addDaysLokal(today, -dow - 7);
    }
    case "bulan-ini":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "bulan-lalu":
      return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    case "kuartal-ini": {
      const q = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), q * 3, 1);
    }
    case "kuartal-lalu": {
      const q = Math.floor(now.getMonth() / 3) - 1;
      return new Date(now.getFullYear(), q * 3, 1);
    }
    case "tahun-ini":
      return new Date(now.getFullYear(), 0, 1);
    case "tahun-lalu":
      return new Date(now.getFullYear() - 1, 0, 1);
    case "custom":
      return today;
  }
}

/** Akhir periode untuk preset. */
export function akhirUntukRingkasanAset(periode: RingkasanAsetPeriode, now = new Date()): Date {
  const today = startOfDayLokal(now);
  switch (periode) {
    case "hari-ini":
      return today;
    case "kemarin":
      return addDaysLokal(today, -1);
    case "minggu-ini": {
      const dow = (today.getDay() + 6) % 7;
      return addDaysLokal(today, -dow + 6);
    }
    case "minggu-lalu": {
      const dow = (today.getDay() + 6) % 7;
      return addDaysLokal(today, -dow - 1);
    }
    case "bulan-ini":
      return new Date(now.getFullYear(), now.getMonth() + 1, 0);
    case "bulan-lalu":
      return new Date(now.getFullYear(), now.getMonth(), 0);
    case "kuartal-ini": {
      const q = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), q * 3 + 3, 0);
    }
    case "kuartal-lalu": {
      const q = Math.floor(now.getMonth() / 3) - 1;
      return new Date(now.getFullYear(), q * 3 + 3, 0);
    }
    case "tahun-ini":
      return new Date(now.getFullYear(), 11, 31);
    case "tahun-lalu":
      return new Date(now.getFullYear() - 1, 11, 31);
    case "custom":
      return today;
  }
}

export function toYMDPendek(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTgl(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Resolusi rentang laporan. Preset berjalan dibatasi sampai hari ini;
 * mode custom memakai tanggal yang diisi user (inklusif).
 */
export function resolveRingkasanAsetPeriode(
  periode: RingkasanAsetPeriode,
  tanggalAwal?: string,
  tanggalAkhir?: string
): { dari: Date; sampai: Date; label: string } {
  let dari: Date;
  let sampai: Date;

  if (periode === "custom") {
    const awal = parseYMD(tanggalAwal);
    const akhir = parseYMD(tanggalAkhir);
    if (!awal || !akhir) throw new Error("Tanggal awal dan akhir wajib diisi");
    if (awal > akhir) throw new Error("Tanggal awal tidak boleh lebih besar dari tanggal akhir");
    dari = awal;
    sampai = akhir;
  } else {
    const now = new Date();
    const today = startOfDayLokal(now);
    dari = startOfDayLokal(awalUntukRingkasanAset(periode, now));
    sampai = startOfDayLokal(akhirUntukRingkasanAset(periode, now));
    if (dari > today) dari = today;
    if (sampai > today) sampai = today;
  }

  return {
    dari,
    sampai,
    label: `Periode ${formatTgl(dari)} - ${formatTgl(sampai)}`,
  };
}
