// Service Laporan Profitabilitas Produk PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data (semuanya data aktual database, tanpa dummy):
// - HANYA DokumenPenjualan tipe PENAGIHAN (= Faktur Penjualan) pada rentang
//   tanggal. Penawaran, Pesanan, Pengiriman, Proforma, dan Tukar Faktur TIDAK
//   dihitung sebagai penjualan.
// - Retur mengikuti konvensi Laporan Penjualan per Produk: item dokumen
//   TUKAR_FAKTUR pada rentang tanggal mengurangi Qty dan Nilai.
// - HPP memakai fungsi bersama Laba Rugi (lib/hpp-stok-server.ts):
//   mutasi RiwayatStok KELUAR sumber PENJUALAN x biaya perolehan rata-rata
//   tertimbang kronologis dari MASUK (opname/pembelian). Harga jual TIDAK
//   pernah dipakai sebagai HPP.
// - Produk tanpa mutasi keluar/biaya perolehan valid: HPP, Profit, Margin,
//   dan Harga Beli Rata-rata bernilai null (ditampilkan "-"), bukan Rp 0.
// - Total HPP hanya menjumlahkan HPP valid (label "HPP Tercatat"). Bila ada
//   HPP belum diketahui, total Profit/Margin juga null ("-").
// - Qty total tidak dijumlahkan bila satuan produk berbeda.
// - Pengelompokan per produk PERSIS seperti Penjualan per Produk (id produk
//   bila ada, selain itu teks deskripsi) agar total penjualannya identik.
// - Total dihitung dari SELURUH baris terfilter (bukan halaman aktif).

import { prisma } from "@/lib/prisma";
import { getHppMutasiStok } from "@/lib/hpp-stok-server";
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

const bulat2 = (v: number) => Math.round(v * 100) / 100;
const bulat1 = (v: number) => Math.round(v * 10) / 10;

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
          select: { id: true, kategori: true },
        })
      : [];
  const masterById = new Map(master.map((m) => [m.id, m]));

  // Satu sumber HPP dengan Laba Rugi (mutasi stok + biaya perolehan kronologis).
  const hppMutasi = await getHppMutasiStok(start, end, { barangIds: ids });

  // Biaya perolehan rata-rata dari riwayat MASUK opname/penyesuaian & pembelian s/d akhir periode,
  // independen dari adanya mutasi KELUAR penjualan.
  const biayaPerolehanMap = new Map<string, number>();
  if (ids.length > 0) {
    const masuks = await prisma.riwayatStok.findMany({
      where: {
        barangId: { in: ids },
        jenis: "MASUK",
        sumber: { in: ["PENYESUAIAN", "PEMBELIAN"] },
        nilaiPerSatuan: { gt: 0 },
        tanggal: { lte: end },
      },
      select: { barangId: true, jumlah: true, nilaiPerSatuan: true },
    });
    const agg = new Map<string, { qty: number; nilai: number }>();
    for (const r of masuks) {
      const qty = Number(r.jumlah ?? 0);
      const harga = Number(r.nilaiPerSatuan ?? 0);
      if (qty <= 0 || harga <= 0) continue;
      const cur = agg.get(r.barangId) ?? { qty: 0, nilai: 0 };
      cur.qty += qty;
      cur.nilai += qty * harga;
      agg.set(r.barangId, cur);
    }
    for (const [id, v] of agg.entries()) {
      if (v.qty > 0) biayaPerolehanMap.set(id, v.nilai / v.qty);
    }
  }

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

  const semua: ProfitabilitasBaris[] = [];
  for (const [key, g] of grup.entries()) {
    if (cariProduk && !g.namaProduk.toLowerCase().includes(cariProduk)) continue;
    if (kategoriFilter && g.kategori !== kategoriFilter) continue;
    const qty = bulat2(g.qtyJual - g.qtyRetur);
    const nilai = bulat2(g.nilaiJual - g.nilaiRetur);
    const hppBarang = g.produkId ? hppMutasi.perBarang.get(g.produkId) : undefined;

    let alasanHpp: string | null = null;
    if (!g.produkId) {
      alasanHpp =
        "item tidak tertaut master Produk sehingga mutasi stok keluar tidak dapat ditelusuri";
    } else if (qty > 0) {
      if (!hppBarang || hppBarang.qtyKeluar <= 0) {
        alasanHpp =
          "tidak ada mutasi stok KELUAR karena PENJUALAN pada periode ini (biaya opname belum dapat dialokasikan ke penjualan)";
      } else if (!hppBarang.valid) {
        alasanHpp = hppBarang.alasan ?? "biaya perolehan HPP belum valid";
      } else if (hppBarang.qtyKeluar + 0.001 < qty) {
        alasanHpp = `qty mutasi stok KELUAR (${hppBarang.qtyKeluar}) lebih kecil dari qty terjual (${qty})`;
      }
    }

    const hppDiketahui = alasanHpp === null;
    const totalHpp = hppDiketahui ? hppBarang?.hpp ?? 0 : null;
    const profit = hppDiketahui && totalHpp != null ? bulat2(nilai - totalHpp) : null;
    const marginPersen =
      profit != null && nilai !== 0 ? bulat1((profit / nilai) * 100) : null;
    // Harga beli rata-rata dari biaya perolehan riwayat MASUK, independen dari HPP penjualan
    let hargaBeliRata: number | null = null;
    if (g.produkId && biayaPerolehanMap.has(g.produkId)) {
      const avg = biayaPerolehanMap.get(g.produkId)!;
      if (Number.isFinite(avg) && avg > 0) hargaBeliRata = bulat2(avg);
    }

    semua.push({
      id: key,
      namaProduk: g.namaProduk,
      qtyTerjual: qty,
      satuan: g.satuan,
      nilaiPenjualan: nilai,
      totalHpp,
      profit,
      marginPersen,
      hargaJualRata: qty !== 0 ? bulat2(nilai / qty) : 0,
      hargaBeliRata,
      kategori: g.kategori,
      hppDiketahui,
      alasanHpp,
    });
  }

  semua.sort((a, b) => a.namaProduk.localeCompare(b.namaProduk, "id"));

  const satuanUnik = [...new Set(semua.map((b) => b.satuan.trim()).filter(Boolean))];
  const satuanTotal = satuanUnik.length === 1 ? satuanUnik[0] : null;
  const totalQty =
    satuanTotal !== null ? bulat2(semua.reduce((s, b) => s + b.qtyTerjual, 0)) : null;
  const totalPenjualan = bulat2(semua.reduce((s, b) => s + b.nilaiPenjualan, 0));
  const totalHpp = bulat2(semua.reduce((s, b) => s + (b.totalHpp ?? 0), 0));
  const adaHppTidakDiketahui = semua.some((b) => !b.hppDiketahui);
  const totalProfit = adaHppTidakDiketahui
    ? null
    : bulat2(semua.reduce((s, b) => s + (b.profit ?? 0), 0));
  const marginTotalPersen =
    totalProfit != null && totalPenjualan !== 0
      ? bulat1((totalProfit / totalPenjualan) * 100)
      : null;

  const catatan: string[] = [];
  if (semua.length > 0) {
    catatan.push(
      "HPP dihitung dari mutasi stok KELUAR PENJUALAN dengan biaya perolehan rata-rata tertimbang kronologis; HPP yang belum diketahui tidak dianggap nol."
    );
  }
  for (const b of semua) {
    if (!b.hppDiketahui) {
      catatan.push(`${b.namaProduk}: HPP belum diketahui karena ${b.alasanHpp}.`);
    }
  }
  if (semua.length > 0 && satuanTotal === null) {
    catatan.push("Total Qty tidak dijumlahkan karena satuan produk berbeda.");
  }

  const slice = paginate ? semua.slice((page - 1) * limit, page * limit) : semua;

  return {
    label,
    dari: start.toISOString(),
    sampai: end.toISOString(),
    baris: slice,
    total: semua.length,
    totalQty,
    satuanTotal,
    totalPenjualan,
    totalHpp,
    totalProfit,
    marginTotalPersen,
    adaHppTidakDiketahui,
    catatan,
  };
}
