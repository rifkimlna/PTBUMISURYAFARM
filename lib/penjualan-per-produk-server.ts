// Service Laporan Penjualan per Produk PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.

import { prisma } from "@/lib/prisma";
import {
  PENJUALAN_PER_PRODUK_PERIODE,
  PENJUALAN_PER_PRODUK_PERIODE_LABEL,
  awalUntukPeriode,
  akhirUntukPeriode,
  resolvePeriodeTanggal,
  type PenjualanPerProdukPeriode,
  type PenjualanBaris,
  type PenjualanPerProdukSnapshot,
} from "@/lib/penjualan-per-produk-types";

export {
  PENJUALAN_PER_PRODUK_PERIODE,
  PENJUALAN_PER_PRODUK_PERIODE_LABEL,
  awalUntukPeriode,
  akhirUntukPeriode,
  resolvePeriodeTanggal,
};
export type {
  PenjualanPerProdukPeriode,
  PenjualanBaris,
  PenjualanPerProdukSnapshot,
};

function formatTgl(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export async function getPenjualanPerProdukSnapshot(
  dari: Date,
  sampai: Date,
  label: string
): Promise<PenjualanPerProdukSnapshot> {
  // Ambil semua produk yang ada transaksi penjualan atau retur dalam periode
  // kita akan ambil detail penjualan dan retur lalu gruppir produk.

  // Detail penjualan dalam periode (tipe PENAGIHAN)
  const penjualanDocs = await prisma.dokumenPenjualan.findMany({
    where: { tipe: "PENAGIHAN", tanggal: { gte: dari, lte: sampai } },
    include: { items: true },
  });

  // Detail retur dalam periode (tipe TUKAR_FAKTUR)
  const returDocs = await prisma.dokumenPenjualan.findMany({
    where: { tipe: "TUKAR_FAKTUR", tanggal: { gte: dari, lte: sampai } },
    include: { items: true },
  });

  // Gruppir oleh produkId bila ada; bila item diketik manual tanpa
  // memilih produk Persediaan (produkId null), grup berdasarkan teks
  // deskripsi agar transaksi tetap muncul di laporan.
  const produkMap = new Map<string, {
    produkId: string;
    kodeProduk: string;
    namaProduk: string;
    unit: string;
    qtyPenjualan: number;
    nilaiPenjualan: number;
    qtyRetur: number;
    nilaiRetur: number;
  }>();

  const kunciItem = (item: { produkId: string | null; deskripsi: string }) => {
    const id = (item.produkId ?? "").trim();
    if (id) return { key: `id:${id}`, produkId: id, kodeProduk: id };
    const teks = (item.deskripsi ?? "").trim().toLowerCase();
    if (!teks) return null;
    return { key: `teks:${teks}`, produkId: "", kodeProduk: "—" };
  };

  const pastikanBaris = (
    key: string,
    produkId: string,
    kodeProduk: string,
    item: { deskripsi: string; unit: string }
  ) => {
    const existing = produkMap.get(key) ?? {
      produkId,
      kodeProduk,
      namaProduk: item.deskripsi ?? "",
      unit: item.unit ?? "",
      qtyPenjualan: 0,
      nilaiPenjualan: 0,
      qtyRetur: 0,
      nilaiRetur: 0,
    };
    produkMap.set(key, existing);
    return existing;
  };

  // Proses penjualan
  for (const doc of penjualanDocs) {
    for (const item of doc.items) {
      const kunci = kunciItem(item);
      if (!kunci) continue;
      const existing = pastikanBaris(kunci.key, kunci.produkId, kunci.kodeProduk, item);
      existing.qtyPenjualan += Number(item.kuantitas ?? 0);
      existing.nilaiPenjualan += Number(item.jumlah ?? 0);
    }
  }

  // Proses retur
  for (const doc of returDocs) {
    for (const item of doc.items) {
      const kunci = kunciItem(item);
      if (!kunci) continue;
      const existing = pastikanBaris(kunci.key, kunci.produkId, kunci.kodeProduk, item);
      existing.qtyRetur += Number(item.kuantitas ?? 0);
      existing.nilaiRetur += Number(item.jumlah ?? 0);
    }
  }

  // Konversi ke array dan hitung harga rata-rata
  const baris: PenjualanBaris[] = [];
  let totalNilaiPenjualan = 0;
  let totalNilaiRetur = 0;

  for (const [key, p] of produkMap.entries()) {
    const hargaRataRata = p.qtyPenjualan > 0 ? p.nilaiPenjualan / p.qtyPenjualan : 0;
    baris.push({
      // Kunci grup unik (id:… / teks:…) agar key React tidak kembar
      // untuk item manual yang produkId-nya kosong.
      id: key,
      kodeProduk: p.kodeProduk,
      namaProduk: p.namaProduk,
      qtyPenjualan: p.qtyPenjualan,
      qtyRetur: p.qtyRetur,
      unit: p.unit,
      nilaiPenjualan: p.nilaiPenjualan,
      nilaiRetur: p.nilaiRetur,
      hargaRataRata,
    });
    totalNilaiPenjualan += p.nilaiPenjualan;
    totalNilaiRetur += p.nilaiRetur;
  }

  // Urutkan berdasarkan nama produk atau kode
  baris.sort((a, b) => a.namaProduk.localeCompare(b.namaProduk, "id"));

  return {
    label,
    tanggalAwalko: dari.toISOString(),
    tanggalAkhir: sampai.toISOString(),
    baris,
    totalNilaiPenjualan,
    totalNilaiRetur,
    totalProduk: baris.length,
  };
}
