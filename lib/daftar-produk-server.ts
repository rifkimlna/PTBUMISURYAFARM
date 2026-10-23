// Service Laporan Daftar Produk PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data (data aktual database, tanpa dummy):
// - PersediaanBarang: master produk yang sama dipakai modul Penjualan &
//   Pembelian (nama, kode/SKU, satuan, batas minimum, harga beli/jual, tipe).
// - RiwayatStok: agregasi MASUK/KELUAR untuk menghitung stok aktual
//   (stok = stokAwal + MASUK - KELUAR). Nilai 0/negatif dibiarkan apa adanya.
// Tanpa pembagian stok per gudang.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { hitungStokSaatIni } from "@/lib/persediaan";
import type { DaftarProdukBaris, DaftarProdukSnapshot } from "@/lib/daftar-produk-types";

function fmtTgl(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function labelDaftarProduk(now = new Date()): string {
  return `Per ${fmtTgl(now)}`;
}

export async function getDaftarProdukSnapshot(cari: string): Promise<DaftarProdukSnapshot> {
  const q = (cari ?? "").trim();

  const where: Prisma.PersediaanBarangWhereInput | undefined = q
    ? {
        OR: [
          { namaBarang: { contains: q, mode: "insensitive" } },
          { id: { contains: q, mode: "insensitive" } },
          { barcode: { contains: q, mode: "insensitive" } },
        ],
      }
    : undefined;

  const [barang, agg] = await Promise.all([
    prisma.persediaanBarang.findMany({ where, orderBy: { namaBarang: "asc" } }),
    prisma.riwayatStok.groupBy({ by: ["barangId", "jenis"], _sum: { jumlah: true } }),
  ]);

  const map = new Map<string, { MASUK: number; KELUAR: number }>();
  for (const a of agg) {
    const entry = map.get(a.barangId) ?? { MASUK: 0, KELUAR: 0 };
    entry[a.jenis] += a._sum.jumlah ?? 0;
    map.set(a.barangId, entry);
  }

  const baris: DaftarProdukBaris[] = barang.map((b) => {
    const isJasa = (b.tipeProduk ?? "BARANG") === "JASA";
    const sums = map.get(b.id) ?? { MASUK: 0, KELUAR: 0 };
    const totalStok = isJasa
      ? null
      : hitungStokSaatIni(b.stokAwal, [
          { jenis: "MASUK", jumlah: sums.MASUK },
          { jenis: "KELUAR", jumlah: sums.KELUAR },
        ]);
    return {
      kode: b.id,
      namaProduk: b.namaBarang,
      satuan: b.satuan,
      totalStok,
      batasMinimum: b.batasMinimum ?? 0,
      hargaBeli: b.hargaBeli == null ? null : Number(b.hargaBeli),
      hargaJual: b.hargaJual == null ? null : Number(b.hargaJual),
    };
  });

  return {
    label: labelDaftarProduk(),
    cari: q,
    baris,
    totalProduk: baris.length,
  };
}
