// Service Laporan Ringkasan Stok Produk PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Perhitungan dibuat konsisten dengan halaman Produk (app/keuangan/produk/page.tsx):
// - Stok = hitungStokSaatIni(stokAwal, RiwayatStok MASUK/KELUAR) — sumber tunggal
//   RiwayatStok, jadi tidak ada mutasi yang dihitung dua kali (faktur/penerimaan
//   pembelian dan dokumen penjualan tidak menulis RiwayatStok).
// - Filter tanggal hanya membatasi RiwayatStok/Faktur dengan tanggal <= akhir hari
//   yang dipilih, sehingga terlihat "kondisi stok per tanggal".
// - Harga rata-rata per unit PERSIS mengikuti halaman Produk:
//   0. hargaRataRataManual yang diisi user di form Produk;
//   1. bila kosong, rata-rata tertimbang harga faktur pembelian via produkId.
//   Tidak memakai Harga Beli / Harga Jual sebagai pengganti. Bila tidak ada
//   data harga sama sekali → null ("—"), bukan Rp 0 dan bukan harga karangan.
// - Total nilai stok = Σ (stok × harga rata-rata) hanya untuk baris yang
//   nilainya valid; baris tanpa harga tidak dihitung sebagai Rp 0.
// Tanpa pembagian stok per gudang.

import { prisma } from "@/lib/prisma";
import { hitungStokSaatIni } from "@/lib/persediaan";
import {
  labelRingkasanStok,
  type RingkasanStokBaris,
  type RingkasanStokSnapshot,
} from "@/lib/ringkasan-stok-types";

export async function getRingkasanStokSnapshot(
  tanggal: Date,
  label: string
): Promise<RingkasanStokSnapshot> {
  const sampaiAkhir = new Date(tanggal);
  sampaiAkhir.setHours(23, 59, 59, 999);

  const [barang, agg, fakturItems] = await Promise.all([
    prisma.persediaanBarang.findMany({
      orderBy: { namaBarang: "asc" },
      select: {
        id: true,
        namaBarang: true,
        satuan: true,
        stokAwal: true,
        tipeProduk: true,
        hargaRataRataManual: true,
      },
    }),
    prisma.riwayatStok.groupBy({
      by: ["barangId", "jenis"],
      where: { tanggal: { lte: sampaiAkhir } },
      _sum: { jumlah: true },
    }),
    prisma.fakturPembelianItem.findMany({
      where: { faktur: { tanggal: { lte: sampaiAkhir } } },
      select: { produkId: true, kuantitas: true, harga: true },
    }),
  ]);

  const stokMap = new Map<string, { MASUK: number; KELUAR: number }>();
  for (const a of agg) {
    const entry = stokMap.get(a.barangId) ?? { MASUK: 0, KELUAR: 0 };
    entry[a.jenis] += a._sum.jumlah ?? 0;
    stokMap.set(a.barangId, entry);
  }

  const hargaMap = new Map<string, { nilai: number; qty: number }>();
  for (const it of fakturItems) {
    if (!it.produkId) continue;
    const qty = Number(it.kuantitas);
    const acc = hargaMap.get(it.produkId) ?? { nilai: 0, qty: 0 };
    acc.nilai += Number(it.harga) * qty;
    acc.qty += qty;
    hargaMap.set(it.produkId, acc);
  }

  const baris: RingkasanStokBaris[] = barang.map((b) => {
    const isJasa = (b.tipeProduk ?? "BARANG") === "JASA";
    const sums = stokMap.get(b.id) ?? { MASUK: 0, KELUAR: 0 };
    const stok = isJasa
      ? null
      : hitungStokSaatIni(b.stokAwal, [
          { jenis: "MASUK", jumlah: sums.MASUK },
          { jenis: "KELUAR", jumlah: sums.KELUAR },
        ]);

    const acc = hargaMap.get(b.id);
    // Harga manual (diisi user di form Produk) mengalahkan perhitungan faktur.
    const hargaManual =
      b.hargaRataRataManual == null ? null : Number(b.hargaRataRataManual);
    // Bila manual kosong: pakai rata-rata tertimbang faktur pembelian via
    // produkId (sama seperti halaman Produk). Bila tidak ada → "—", bukan Rp 0.
    const hargaRataRata =
      hargaManual != null
        ? Math.round(hargaManual * 100) / 100
        : acc != null && acc.qty > 0
          ? Math.round((acc.nilai / acc.qty) * 100) / 100
          : null;
    const totalNilai =
      stok != null && hargaRataRata != null
        ? Math.round(stok * hargaRataRata * 100) / 100
        : null;

    return {
      kode: b.id,
      namaProduk: b.namaBarang,
      satuan: b.satuan,
      stok,
      hargaRataRata,
      totalNilai,
    };
  });

  let totalStok = 0;
  let totalNilai = 0;
  let adaNilaiValid = false;
  for (const b of baris) {
    if (b.stok != null) totalStok += b.stok;
    if (b.totalNilai != null) {
      totalNilai += b.totalNilai;
      adaNilaiValid = true;
    }
  }

  return {
    label,
    tanggal: sampaiAkhir.toISOString(),
    baris,
    totalProduk: baris.length,
    totalStok,
    // Total hanya menjumlahkan nilai produk yang valid. Bila tidak ada satu pun
    // nilai valid tetapi ada produk, tampilkan "—" (bukan Rp 0 karangan).
    // Daftar kosong tetap Rp 0. Tabel/PDF/XLSX memakai nilai yang sama.
    totalNilai: adaNilaiValid || baris.length === 0 ? totalNilai : null,
  };
}

export { labelRingkasanStok };
