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

  // Gruppir oleh produkId (snapshot id dari PersediaanBarang)
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

  // Proses penjualan
  for (const doc of penjualanDocs) {
    for (const item of doc.items) {
      const produkId = item.produkId ?? "";
      if (produkId === "") continue; // skip if no product id
      const existing = produkMap.get(produkId) ?? {
        produkId,
        kodeProduk: produkId, // assume produkId is the kodeProduk/SKU
        namaProduk: item.deskripsi ?? "",
        unit: item.unit ?? "",
        qtyPenjualan: 0,
        nilaiPenjualan: 0,
        qtyRetur: 0,
        nilaiRetur: 0,
      };
      existing.qtyPenjualan += Number(item.kuantitas ?? 0);
      existing.nilaiPenjualan += Number(item.jumlah ?? 0);
      produkMap.set(produkId, existing);
    }
  }

  // Proses retur
  for (const doc of returDocs) {
    for (const item of doc.items) {
      const produkId = item.produkId ?? "";
      if (produkId === "") continue;
      const existing = produkMap.get(produkId) ?? {
        produkId,
        kodeProduk: produkId,
        namaProduk: item.deskripsi ?? "",
        unit: item.unit ?? "",
        qtyPenjualan: 0,
        nilaiPenjualan: 0,
        qtyRetur: 0,
        nilaiRetur: 0,
      };
      existing.qtyRetur += Number(item.kuantitas ?? 0);
      existing.nilaiRetur += Number(item.jumlah ?? 0);
      produkMap.set(produkId, existing);
    }
  }

  // Konversi ke array dan hitung harga rata-rata
  const baris: PenjualanBaris[] = [];
  let totalNilaiPenjualan = 0;
  let totalNilaiRetur = 0;

  for (const p of produkMap.values()) {
    const hargaRataRata = p.qtyPenjualan > 0 ? p.nilaiPenjualan / p.qtyPenjualan : 0;
    baris.push({
      id: p.produkId,
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
