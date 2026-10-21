// Service Laporan Pembelian per Produk PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data (semuanya data aktual database, tanpa dummy):
// - Pembelian: FakturPembelian (= purchase invoice yang disimpan saat barang
//   ditagih supplier) pada rentang tanggal, beserta FakturPembelianItem
//   (produk, kuantitas, unit, jumlah). Hanya model ini dibaca agar dokumen
//   rantai (PERMINTAAN/PENAWARAN/PESANAN) tidak terhitung ganda — pola yang
//   sama dengan lib/pembelian-per-supplier-server.ts.
// - Retur: DokumenPembelian tipe TUKAR_FAKTUR pada rentang tanggal beserta
//   itemnya (konvensi yang sama dengan Retur Penjualan = DokumenPenjualan
//   TUKAR_FAKTUR di lib/penjualan-per-produk-server.ts). Bila tidak ada
//   pencatatan retur, Qty/Nilai Retur bernilai 0 (bukan dummy).
// - Direkap per produk: produkId PersediaanBarang (= Kode Produk/SKU); item
//   manual tanpa produkId digrup berdasarkan teks deskripsi.
// - Harga pembelian rata-rata = nilai pembelian / qty pembelian (bila qty > 0).

import { prisma } from "@/lib/prisma";
import {
  PEMBELIAN_PER_PRODUK_PERIODE,
  PEMBELIAN_PER_PRODUK_PERIODE_LABEL,
  awalUntukPembelianPerProduk,
  akhirUntukPembelianPerProduk,
  rentangUntukPembelianPerProduk,
  type PembelianPerProdukPeriode,
  type PembelianPerProdukBaris,
  type PembelianPerProdukSnapshot,
} from "@/lib/pembelian-per-produk-types";

export {
  PEMBELIAN_PER_PRODUK_PERIODE,
  PEMBELIAN_PER_PRODUK_PERIODE_LABEL,
  awalUntukPembelianPerProduk,
  akhirUntukPembelianPerProduk,
  rentangUntukPembelianPerProduk,
};
export type {
  PembelianPerProdukPeriode,
  PembelianPerProdukBaris,
  PembelianPerProdukSnapshot,
};

// ---------- Rentang periode (kalender lokal) ----------

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date) {
  const x = startOfDay(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function fmtTgl(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function resolvePembelianPerProdukTanggal(
  periode: PembelianPerProdukPeriode,
  dari?: string,
  sampai?: string
): { start: Date; end: Date; label: string } {
  if (periode === "custom") {
    if (!dari || !sampai) throw new Error("Tanggal awal dan tanggal akhir wajib diisi");
    const s = startOfDay(new Date(dari));
    const e = new Date(sampai);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) throw new Error("Tanggal tidak valid");
    if (endOfDay(e) < s) throw new Error("Tanggal akhir tidak boleh lebih awal dari tanggal awal");
    return { start: s, end: endOfDay(e), label: `Periode ${fmtTgl(s)} - ${fmtTgl(e)}` };
  }
  const start = startOfDay(awalUntukPembelianPerProduk(periode));
  const end = endOfDay(akhirUntukPembelianPerProduk(periode));
  return { start, end, label: `Periode ${fmtTgl(start)} - ${fmtTgl(end)}` };
}

// ---------- Query snapshot ----------

export async function getPembelianPerProdukSnapshot(
  start: Date,
  end: Date,
  label: string
): Promise<PembelianPerProdukSnapshot> {
  const dalam = { gte: start, lte: end };
  const num = (v: unknown) => Number(v ?? 0);

  // Pembelian riil: faktur pembelian (satu-satunya dokumen yang menghasilkan
  // utang). Dokumen rantai tidak dibaca agar tidak terhitung ganda.
  const faktur = await prisma.fakturPembelian.findMany({
    where: { tanggal: dalam },
    include: { items: true },
  });

  // Retur: tukar faktur pembelian (konvensi retur, sama dengan sisi penjualan).
  const retur = await prisma.dokumenPembelian.findMany({
    where: { tipe: "TUKAR_FAKTUR", tanggal: dalam },
    include: { items: true },
  });

  type Akumulasi = {
    produkId: string;
    kodeProduk: string;
    namaProduk: string;
    unit: string;
    qtyPembelian: number;
    nilaiPembelian: number;
    qtyRetur: number;
    nilaiRetur: number;
  };

  const produkMap = new Map<string, Akumulasi>();

  // Grup per produkId bila ada; bila item diketik manual tanpa produk Persediaan
  // (produkId null), grup berdasarkan teks deskripsi agar tetap muncul.
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
      qtyPembelian: 0,
      nilaiPembelian: 0,
      qtyRetur: 0,
      nilaiRetur: 0,
    };
    produkMap.set(key, existing);
    return existing;
  };

  for (const f of faktur) {
    for (const item of f.items) {
      const kunci = kunciItem(item);
      if (!kunci) continue;
      const row = pastikanBaris(kunci.key, kunci.produkId, kunci.kodeProduk, item);
      row.qtyPembelian += num(item.kuantitas);
      row.nilaiPembelian += num(item.jumlah);
    }
  }

  for (const d of retur) {
    for (const item of d.items) {
      const kunci = kunciItem(item);
      if (!kunci) continue;
      const row = pastikanBaris(kunci.key, kunci.produkId, kunci.kodeProduk, item);
      row.qtyRetur += num(item.kuantitas);
      row.nilaiRetur += num(item.jumlah);
    }
  }

  const baris: PembelianPerProdukBaris[] = [];
  let totalNilaiPembelian = 0;
  let totalNilaiRetur = 0;

  for (const [key, p] of produkMap.entries()) {
    const hargaRataRata = p.qtyPembelian > 0 ? p.nilaiPembelian / p.qtyPembelian : 0;
    baris.push({
      id: key,
      kodeProduk: p.kodeProduk,
      namaProduk: p.namaProduk,
      qtyPembelian: p.qtyPembelian,
      qtyRetur: p.qtyRetur,
      unit: p.unit,
      nilaiPembelian: p.nilaiPembelian,
      nilaiRetur: p.nilaiRetur,
      hargaRataRata,
    });
    totalNilaiPembelian += p.nilaiPembelian;
    totalNilaiRetur += p.nilaiRetur;
  }

  baris.sort((a, b) => a.namaProduk.localeCompare(b.namaProduk, "id"));

  return {
    label,
    start: start.toISOString(),
    end: end.toISOString(),
    baris,
    totalNilaiPembelian,
    totalNilaiRetur,
    totalProduk: baris.length,
  };
}
