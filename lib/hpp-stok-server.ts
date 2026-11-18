// Service HPP bersama (Laba Rugi + Profitabilitas Produk) PT Bumi Surya Farm.
// JANGAN diimpor dari Client Component — memakai prisma.
//
// Dasar perhitungan: mutasi stok RiwayatStok, bukan harga jual/master produk.
// - Biaya perolehan = MASUK sumber PENYESUAIAN (opname) / PEMBELIAN yang
//   memiliki nilaiPerSatuan > 0.
// - Rata-rata tertimbang dihitung kronologis: setiap MASUK berbiaya
//   memperbarui (total nilai / total qty) sebelum KELUAR berikutnya.
// - HPP hanya dihitung untuk KELUAR sumber PENJUALAN pada rentang laporan.
// - Bila belum ada biaya perolehan valid, HPP TIDAK dianggap Rp 0:
//   baris ditandai tidak diketahui agar laporan tidak menyesatkan.
// - Fungsi ini juga dipakai getLabaRugi agar HPP laporan produk dan Laba Rugi
//   berasal dari satu perhitungan yang sama.

import { prisma } from "@/lib/prisma";

const num = (v: unknown) => Number(v ?? 0);

export type MutasiHppInput = {
  id: string;
  barangId: string;
  nama: string;
  satuan: string;
  jenis: "MASUK" | "KELUAR";
  jumlah: number;
  nilaiPerSatuan: number | null;
  tanggal: Date;
  createdAt?: Date;
  sumber: string | null;
};

export type HppMutasiKeluaran = {
  id: string;
  barangId: string;
  nama: string;
  satuan: string;
  tanggal: Date;
  jumlah: number;
  biayaRataRata: number | null;
  hpp: number;
  valid: boolean;
  alasan: string | null;
};

export type HppMutasiBarang = {
  barangId: string;
  nama: string;
  satuan: string;
  qtyKeluar: number;
  qtyHppValid: number;
  hpp: number;
  /** True bila SEMUA mutasi KELUAR PENJUALAN barang ini punya biaya valid. */
  valid: boolean;
  /** Biaya perolehan rata-rata tertimbang dari unit yang HPP-nya valid. */
  biayaRataRata: number | null;
  alasan: string | null;
};

export type HppMutasiResult = {
  totalHpp: number;
  totalQtyKeluar: number;
  perBarang: Map<string, HppMutasiBarang>;
  keluaran: HppMutasiKeluaran[];
  missingHppItems: { barangId: string; nama: string; qty: number; alasan: string }[];
  catatan: string[];
};

const ALASAN_TANPA_BIAYA =
  "tidak ada biaya perolehan valid (mutasi MASUK PENYESUAIAN/PEMBELIAN dengan nilai per satuan) sebelum penjualan";

function alasanTidakValid(totalQtyMasuk: number, totalNilaiMasuk: number): string {
  if (totalQtyMasuk <= 0) return ALASAN_TANPA_BIAYA;
  if (totalNilaiMasuk <= 0) return "nilai perolehan rata-rata tertimbang masih Rp 0";
  return ALASAN_TANPA_BIAYA;
}

/**
 * Inti perhitungan HPP dari mutasi stok (murni, tanpa database) agar bisa diuji.
 * `mutasi` boleh memuat seluruh riwayat s/d tanggal akhir; KELUAR di luar
 * [start, end] diabaikan, MASUK sebelum start tetap dipakai sebagai biaya awal.
 */
export function hitungHppMutasi(
  mutasi: MutasiHppInput[],
  start: Date,
  end: Date
): HppMutasiResult {
  const urut = [...mutasi].sort((a, b) => {
    const ta = a.tanggal.getTime();
    const tb = b.tanggal.getTime();
    if (ta !== tb) return ta - tb;
    const ca = a.createdAt?.getTime() ?? 0;
    const cb = b.createdAt?.getTime() ?? 0;
    if (ca !== cb) return ca - cb;
    return a.id.localeCompare(b.id);
  });

  type State = { qtyMasuk: number; nilaiMasuk: number };
  const state = new Map<string, State>();
  const perBarang = new Map<string, HppMutasiBarang>();
  const keluaran: HppMutasiKeluaran[] = [];
  const missingHppItems: HppMutasiResult["missingHppItems"] = [];
  let totalHpp = 0;
  let totalQtyKeluar = 0;

  const pastikanBarang = (r: MutasiHppInput): HppMutasiBarang => {
    let b = perBarang.get(r.barangId);
    if (!b) {
      b = {
        barangId: r.barangId,
        nama: r.nama,
        satuan: r.satuan,
        qtyKeluar: 0,
        qtyHppValid: 0,
        hpp: 0,
        valid: false,
        biayaRataRata: null,
        alasan: null,
      };
      perBarang.set(r.barangId, b);
    }
    return b;
  };

  for (const r of urut) {
    if (r.tanggal > end) continue;

    if (r.jenis === "MASUK") {
      if (r.sumber !== "PENYESUAIAN" && r.sumber !== "PEMBELIAN") continue;
      const nilaiSatuan = r.nilaiPerSatuan == null ? 0 : num(r.nilaiPerSatuan);
      if (!(nilaiSatuan > 0)) continue;
      const qty = num(r.jumlah);
      if (!(qty > 0)) continue;
      const s = state.get(r.barangId) ?? { qtyMasuk: 0, nilaiMasuk: 0 };
      s.qtyMasuk += qty;
      s.nilaiMasuk += qty * nilaiSatuan;
      state.set(r.barangId, s);
      continue;
    }

    // KELUAR: hanya mutasi penjualan dalam periode yang menghasilkan HPP.
    if (r.sumber !== "PENJUALAN") continue;
    if (r.tanggal < start) continue;
    const qty = num(r.jumlah);
    if (!(qty > 0)) continue;

    const b = pastikanBarang(r);
    b.qtyKeluar += qty;
    totalQtyKeluar += qty;

    const s = state.get(r.barangId) ?? { qtyMasuk: 0, nilaiMasuk: 0 };
    const biaya = s.qtyMasuk > 0 ? s.nilaiMasuk / s.qtyMasuk : 0;
    const valid = biaya > 0 && Number.isFinite(biaya);
    const hpp = valid ? Math.round(qty * biaya) : 0;
    const alasan = valid ? null : alasanTidakValid(s.qtyMasuk, s.nilaiMasuk);

    keluaran.push({
      id: r.id,
      barangId: r.barangId,
      nama: r.nama,
      satuan: r.satuan,
      tanggal: r.tanggal,
      jumlah: qty,
      biayaRataRata: valid ? biaya : null,
      hpp,
      valid,
      alasan,
    });

    if (valid) {
      b.qtyHppValid += qty;
      b.hpp += hpp;
      totalHpp += hpp;
    } else {
      b.alasan = b.alasan ?? alasan;
      missingHppItems.push({ barangId: r.barangId, nama: r.nama, qty, alasan: alasan ?? ALASAN_TANPA_BIAYA });
    }
  }

  for (const b of perBarang.values()) {
    b.valid = b.qtyKeluar > 0 && b.qtyHppValid >= b.qtyKeluar;
    b.biayaRataRata = b.qtyHppValid > 0 ? b.hpp / b.qtyHppValid : null;
    if (b.valid) b.alasan = null;
  }

  const catatan = [...perBarang.values()]
    .filter((b) => !b.valid)
    .map(
      (b) =>
        `${b.nama}: HPP belum diketahui karena ${b.alasan ?? ALASAN_TANPA_BIAYA}.`
    );

  return { totalHpp, totalQtyKeluar, perBarang, keluaran, missingHppItems, catatan };
}

/** Muat mutasi stok lalu hitung HPP dengan fungsi inti yang sama. */
export async function getHppMutasiStok(
  start: Date,
  end: Date,
  opts?: { barangIds?: string[] }
): Promise<HppMutasiResult> {
  const ids = opts?.barangIds?.filter(Boolean);
  if (ids && ids.length === 0) return hitungHppMutasi([], start, end);

  const rows = await prisma.riwayatStok.findMany({
    where: {
      ...(ids ? { barangId: { in: ids } } : {}),
      jenis: { in: ["MASUK", "KELUAR"] },
      tanggal: { lte: end },
    },
    select: {
      id: true,
      barangId: true,
      jenis: true,
      jumlah: true,
      nilaiPerSatuan: true,
      tanggal: true,
      createdAt: true,
      sumber: true,
      barang: { select: { namaBarang: true, satuan: true } },
    },
    orderBy: [{ tanggal: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  const mutasi: MutasiHppInput[] = rows.map((r) => ({
    id: r.id,
    barangId: r.barangId,
    nama: r.barang?.namaBarang ?? r.barangId,
    satuan: r.barang?.satuan ?? "",
    jenis: r.jenis,
    jumlah: num(r.jumlah),
    nilaiPerSatuan: r.nilaiPerSatuan == null ? null : num(r.nilaiPerSatuan),
    tanggal: r.tanggal,
    createdAt: r.createdAt,
    sumber: r.sumber,
  }));

  return hitungHppMutasi(mutasi, start, end);
}
