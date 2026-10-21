// Service Laporan Profitabilitas Produk PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data (semuanya data aktual database, tanpa dummy):
// - HANYA DokumenPenjualan tipe PENAGIHAN (= Faktur Penjualan) pada rentang
//   tanggal. Penawaran, Pesanan, Pengiriman, Proforma, dan Tukar Faktur TIDAK
//   dihitung.
// - Retur mengikuti konvensi Laporan Penjualan per Produk: item dokumen
//   TUKAR_FAKTUR pada rentang tanggal mengurangi Qty dan Nilai.
// - HPP per unit dari master Produk (PersediaanBarang): hargaBeli, fallback
//   hargaSatuan mengikuti konvensi HPP Laba Rugi; item ketikan manual tanpa
//   master (produkId null) HPP = Rp 0.
// - Pengelompokan per produk PERSIS seperti Penjualan per Produk (id produk
//   bila ada, sonst teks deskripsi) agar totalnya identik.
// - Total dihitung dari SELURUH baris terfilter (bukan halaman aktif).

import { prisma } from "@/lib/prisma";
import type {
  ProfitabilitasBaris,
  ProfitabilitasSnapshot,
} from "@/lib/profitabilitas-produk-types";

export type {
  ProfitabilitasBaris,
  ProfitabilitasFilter,
  ProfitabilitasSnapshot,
} from "@/lib/profitabilitas-produk-types";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date) {
  const x = startOfDay(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function resolveProfitRentang(dari?: string, sampai?: string): { start: Date; end: Date } {
  const now = new Date();
  const s = dari ? startOfDay(new Date(dari)) : startOfDay(now);
  const e = sampai ? new Date(sampai) : new Date(now);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) throw new Error("Tanggal tidak valid");
  if (endOfDay(e) < s) throw new Error("Tanggal akhir tidak boleh lebih awal dari tanggal awal");
  return { start: s, end: endOfDay(e) };
}

export async function getProfitabilitasSnapshot(
  start: Date,
  end: Date,
  label: string,
  opts?: { page?: number; limit?: number; paginate?: boolean; produk?: string; kategori?: string }
): Promise<ProfitabilitasSnapshot> {
  const dalam = { gte: start, lte: end };
  const page = Math.max(1, opts?.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 25));
  const paginate = opts?.paginate ?? true;
  const cariProduk = (opts?.produk ?? "").trim().toLowerCase();
  const kategoriFilter = (opts?.kategori ?? "").trim();

  const [penjualanDocs, returDocs] = await Promise.all([
    prisma.dokumenPenjualan.findMany({
      where: { tipe: "PENAGIHAN", tanggal: dalam },
      include: { items: true },
    }),
    prisma.dokumenPenjualan.findMany({
      where: { tipe: "TUKAR_FAKTUR", tanggal: dalam },
      include: { items: true },
    }),
  ]);

  // HPP master untuk produk yang punya produkId.
  const ids = [...new Set(
    [...penjualanDocs, ...returDocs]
      .flatMap((d) => d.items)
      .map((it) => (it.produkId ?? "").trim())
      .filter(Boolean)
  )];
  const master =
    ids.length > 0
      ? await prisma.persediaanBarang.findMany({
          where: { id: { in: ids } },
          select: { id: true, hargaBeli: true, hargaSatuan: true, kategori: true },
        })
      : [];
  const masterById = new Map(master.map((m) => [m.id, m]));
  const hppSatuan = (produkId: string): number => {
    const m = masterById.get(produkId);
    if (!m) return 0;
    const beli = m.hargaBeli == null ? null : Number(m.hargaBeli);
    if (beli != null && !Number.isNaN(beli)) return beli;
    const satuan = Number(m.hargaSatuan ?? 0);
    return Number.isNaN(satuan) ? 0 : satuan;
  };

  type Agregat = {
    produkId: string;
    namaProduk: string;
    satuan: string;
    kategori: string;
    qtyJual: number;
    nilaiJual: number;
    qtyRetur: number;
    nilaiRetur: number;
  };
  const grup = new Map<string, Agregat>();

  const kunciItem = (item: { produkId: string | null; deskripsi: string }) => {
    const id = (item.produkId ?? "").trim();
    if (id) return `id:${id}`;
    const teks = (item.deskripsi ?? "").trim().toLowerCase();
    if (!teks) return null;
    return `teks:${teks}`;
  };

  const pastikan = (
    key: string,
    item: { produkId: string | null; deskripsi: string; unit: string }
  ): Agregat => {
    let cur = grup.get(key);
    if (!cur) {
      const pid = (item.produkId ?? "").trim();
      const m = pid ? masterById.get(pid) : undefined;
      cur = {
        produkId: pid,
        namaProduk: (item.deskripsi ?? "").trim() || "—",
        satuan: (item.unit ?? "").trim(),
        kategori: m?.kategori?.trim() || "—",
        qtyJual: 0,
        nilaiJual: 0,
        qtyRetur: 0,
        nilaiRetur: 0,
      };
      grup.set(key, cur);
    }
    return cur;
  };

  for (const doc of penjualanDocs) {
    for (const item of doc.items) {
      const key = kunciItem(item);
      if (!key) continue;
      const cur = pastikan(key, item);
      cur.qtyJual += Number(item.kuantitas ?? 0);
      cur.nilaiJual += Number(item.jumlah ?? 0);
    }
  }
  for (const doc of returDocs) {
    for (const item of doc.items) {
      const key = kunciItem(item);
      if (!key) continue;
      const cur = pastikan(key, item);
      cur.qtyRetur += Number(item.kuantitas ?? 0);
      cur.nilaiRetur += Number(item.jumlah ?? 0);
    }
  }

  let semua: ProfitabilitasBaris[] = [];
  for (const [key, g] of grup.entries()) {
    if (cariProduk && !g.namaProduk.toLowerCase().includes(cariProduk)) continue;
    if (kategoriFilter && g.kategori !== kategoriFilter) continue;
    const qty = Math.round((g.qtyJual - g.qtyRetur) * 100) / 100;
    const nilai = Math.round((g.nilaiJual - g.nilaiRetur) * 100) / 100;
    const hppUnit = g.produkId ? hppSatuan(g.produkId) : 0;
    const totalHpp = Math.round(qty * hppUnit * 100) / 100;
    const profit = Math.round((nilai - totalHpp) * 100) / 100;
    semua.push({
      id: key,
      namaProduk: g.namaProduk,
      qtyTerjual: qty,
      satuan: g.satuan,
      nilaiPenjualan: nilai,
      totalHpp,
      profit,
      marginPersen: nilai !== 0 ? Math.round((profit / nilai) * 1000) / 10 : 0,
      hargaJualRata: qty !== 0 ? Math.round((nilai / qty) * 100) / 100 : 0,
      hargaBeliRata: qty !== 0 ? Math.round((totalHpp / qty) * 100) / 100 : 0,
      kategori: g.kategori,
    });
  }

  semua.sort((a, b) => a.namaProduk.localeCompare(b.namaProduk, "id"));

  const totalQty = Math.round(semua.reduce((s, b) => s + b.qtyTerjual, 0) * 100) / 100;
  const totalPenjualan = Math.round(semua.reduce((s, b) => s + b.nilaiPenjualan, 0) * 100) / 100;
  const totalHpp = Math.round(semua.reduce((s, b) => s + b.totalHpp, 0) * 100) / 100;
  const totalProfit = Math.round(semua.reduce((s, b) => s + b.profit, 0) * 100) / 100;

  const slice = paginate ? semua.slice((page - 1) * limit, page * limit) : semua;

  return {
    label,
    dari: start.toISOString(),
    sampai: end.toISOString(),
    baris: slice,
    total: semua.length,
    totalQty,
    totalPenjualan,
    totalHpp,
    totalProfit,
    marginTotalPersen:
      totalPenjualan !== 0 ? Math.round((totalProfit / totalPenjualan) * 1000) / 10 : 0,
  };
}
