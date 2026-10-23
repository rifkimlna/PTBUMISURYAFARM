// Service Laporan Pengiriman Pembelian PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data (semuanya data aktual database, tanpa dummy):
// - PengirimanPembelian pada rentang tanggal (tanggalPengiriman, fallback
//   createdAt bila kosong) + PengirimanBeliItem + nama Supplier.
//   HANYA dokumen pengiriman/penerimaan; Pesanan (PO) & Faktur tidak diambil.
// - Kode produk/SKU dari master PersediaanBarang (barcode) via produkId
//   snapshot Pesanan asal (cocok deskripsi + satuan); fallback produkId, else
//   "—". Nama produk = deskripsi item (snapshot saat pengiriman).
// - Dikelompokkan per supplier + subtotal per supplier + grand total.

import { prisma } from "@/lib/prisma";
import type {
  PengirimanBeliGrup,
  PengirimanPembelianPeriode,
  PengirimanPembelianSnapshot,
} from "@/lib/pengiriman-pembelian-types";

export {
  PENGIRIMAN_PEMBELIAN_PERIODE,
  PENGIRIMAN_PEMBELIAN_PERIODE_LABEL,
  rentangUntukPengirimanPembelian,
} from "@/lib/pengiriman-pembelian-types";
export type {
  PengirimanBeliGrup,
  PengirimanBeliItemBaris,
  PengirimanPembelianPeriode,
  PengirimanPembelianSnapshot,
} from "@/lib/pengiriman-pembelian-types";

// ---------- Rentang periode (kalender lokal) ----------

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date) {
  const x = startOfDay(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtTgl(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function resolvePengirimanPembelianRange(
  periode: PengirimanPembelianPeriode,
  dari?: string,
  sampai?: string
): { start: Date; end: Date; label: string } {
  const now = new Date();
  const today = startOfDay(now);

  switch (periode) {
    case "hari-ini":
      return { start: today, end: endOfDay(today), label: fmtTgl(today) };
    case "kemarin": {
      const y = addDays(today, -1);
      return { start: y, end: endOfDay(y), label: fmtTgl(y) };
    }
    case "minggu-ini": {
      const dow = (today.getDay() + 6) % 7;
      const s = addDays(today, -dow);
      const e = addDays(s, 6);
      return { start: s, end: endOfDay(e), label: `${fmtTgl(s)} – ${fmtTgl(e)}` };
    }
    case "minggu-lalu": {
      const dow = (today.getDay() + 6) % 7;
      const s = addDays(today, -dow - 7);
      const e = addDays(s, 6);
      return { start: s, end: endOfDay(e), label: `${fmtTgl(s)} – ${fmtTgl(e)}` };
    }
    case "bulan-ini": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: s, end: endOfDay(last), label: `${fmtTgl(s)} – ${fmtTgl(last)}` };
    }
    case "bulan-lalu": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: s, end: endOfDay(last), label: `${fmtTgl(s)} – ${fmtTgl(last)}` };
    }
    case "tahun-ini": {
      const s = new Date(now.getFullYear(), 0, 1);
      const last = new Date(now.getFullYear(), 11, 31);
      return { start: s, end: endOfDay(last), label: `${fmtTgl(s)} – ${fmtTgl(last)}` };
    }
    case "tahun-lalu": {
      const s = new Date(now.getFullYear() - 1, 0, 1);
      const last = new Date(now.getFullYear() - 1, 11, 31);
      return { start: s, end: endOfDay(last), label: `${fmtTgl(s)} – ${fmtTgl(last)}` };
    }
    case "custom": {
      if (!dari || !sampai) throw new Error("Periode custom membutuhkan tanggal awal & tanggal akhir");
      const s = startOfDay(new Date(dari));
      const e = new Date(sampai);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()))
        throw new Error("Tanggal custom tidak valid");
      if (endOfDay(e) < s) throw new Error("Tanggal akhir tidak boleh lebih awal dari tanggal awal");
      return { start: s, end: endOfDay(e), label: `${fmtTgl(s)} – ${fmtTgl(e)}` };
    }
  }
}

// ---------- Query snapshot ----------

export async function getPengirimanPembelianSnapshot(
  start: Date,
  end: Date,
  label: string
): Promise<PengirimanPembelianSnapshot> {
  const dalam = { gte: start, lte: end };
  const num = (v: unknown) => Number(v ?? 0);

  const kirim = await prisma.pengirimanPembelian.findMany({
    where: {
      OR: [{ tanggalPengiriman: dalam }, { tanggalPengiriman: null, createdAt: dalam }],
    },
    orderBy: [{ supplier: { nama: "asc" } }, { tanggalPengiriman: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      noPengiriman: true,
      tanggalPengiriman: true,
      createdAt: true,
      supplier: { select: { nama: true } },
      pesanan: {
        select: {
          items: { select: { produkId: true, deskripsi: true, unit: true } },
        },
      },
      items: {
        orderBy: { id: "asc" },
        select: { id: true, deskripsi: true, unit: true, kuantitas: true, jumlah: true },
      },
    },
  });

  // Kode produk/SKU: PengirimanBeliItem tidak menyimpan produkId, jadi
  // dipetakan dari item Pesanan asal (cocok deskripsi + satuan) lalu ke
  // barcode master PersediaanBarang. Tanpa pasangan: "—" (data asli).
  const produkIds = [
    ...new Set(
      kirim.flatMap((k) => k.pesanan?.items ?? []).map((i) => i.produkId).filter(Boolean)
    ),
  ] as string[];
  const barang =
    produkIds.length > 0
      ? await prisma.persediaanBarang.findMany({
          where: { id: { in: produkIds } },
          select: { id: true, barcode: true },
        })
      : [];
  const barcodeOf = new Map(barang.map((b) => [b.id, b.barcode]));

  const grupMap = new Map<string, PengirimanBeliGrup>();
  let totalBaris = 0;

  for (const k of kirim) {
    const supplier = k.supplier?.nama?.trim() || "—";
    const g = grupMap.get(supplier) ?? { supplier, baris: [], totalQty: 0, totalJumlah: 0 };
    const pesananItems = k.pesanan?.items ?? [];
    for (const it of k.items) {
      const qty = num(it.kuantitas);
      const jumlah = Math.round(num(it.jumlah));
      const asal = pesananItems.find(
        (p) => p.deskripsi?.trim() === it.deskripsi?.trim() && (p.unit?.trim() || "") === (it.unit?.trim() || "")
      );
      const produkId = asal?.produkId ?? null;
      g.baris.push({
        id: it.id,
        kode: (produkId ? barcodeOf.get(produkId) || produkId : null) || "—",
        nama: it.deskripsi?.trim() || "—",
        unit: it.unit?.trim() || "—",
        qty,
        jumlah,
      });
      g.totalQty += qty;
      g.totalJumlah += jumlah;
      totalBaris += 1;
    }
    grupMap.set(supplier, g);
  }

  const grup = [...grupMap.values()].sort((a, b) => a.supplier.localeCompare(b.supplier, "id"));
  return {
    label,
    start: start.toISOString(),
    end: end.toISOString(),
    grup,
    grandQty: grup.reduce((s, g) => s + g.totalQty, 0),
    grandJumlah: grup.reduce((s, g) => s + g.totalJumlah, 0),
    totalBaris,
  };
}
