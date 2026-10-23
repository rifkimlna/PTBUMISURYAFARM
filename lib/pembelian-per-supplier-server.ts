// Service Laporan Pembelian per Supplier PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data (semuanya data aktual database, tanpa dummy):
// - FakturPembelian (= purchase invoice yang disimpan saat barang ditagih
//   supplier) pada rentang tanggal. Hanya model ini dibaca agar dokumen
//   rantai (DokumenPembelian PERMINTAAN/PENAWARAN/PESANAN) dan Tukar Faktur
//   tidak terhitung ganda — pola yang sama dengan lib/daftar-pembelian-server.ts.
// - Relasi Supplier -> Faktur Pembelian -> FakturPembelianItem (deskripsi,
//   kuantitas, unit, harga, diskonPersen, jumlah). Keterangan baris = info
//   diskon item bila ada, selain itu "—".
// - Dikelompokkan per supplier + subtotal per supplier + grand total
//   (dari total faktur, bukan penjumlahan baris item).

import { prisma } from "@/lib/prisma";
import type {
  PembelianGrup,
  PembelianPerSupplierPeriode,
  PembelianPerSupplierSnapshot,
} from "@/lib/pembelian-per-supplier-types";

export {
  PEMBELIAN_PER_SUPPLIER_PERIODE,
  PEMBELIAN_PER_SUPPLIER_PERIODE_LABEL,
  rentangUntukPembelianPerSupplier,
} from "@/lib/pembelian-per-supplier-types";
export type {
  PembelianGrup,
  PembelianItemBaris,
  PembelianPerSupplierPeriode,
  PembelianPerSupplierSnapshot,
} from "@/lib/pembelian-per-supplier-types";

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

export function resolvePembelianPerSupplierRange(
  periode: PembelianPerSupplierPeriode,
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
    case "kuartal-ini": {
      const q = Math.floor(now.getMonth() / 3);
      const s = new Date(now.getFullYear(), q * 3, 1);
      const last = new Date(s.getFullYear(), s.getMonth() + 3, 0);
      return { start: s, end: endOfDay(last), label: `${fmtTgl(s)} – ${fmtTgl(last)}` };
    }
    case "kuartal-lalu": {
      const q = Math.floor(now.getMonth() / 3) - 1;
      const s = new Date(now.getFullYear(), q * 3, 1);
      const last = new Date(s.getFullYear(), s.getMonth() + 3, 0);
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

export async function getPembelianPerSupplierSnapshot(
  start: Date,
  end: Date,
  label: string
): Promise<PembelianPerSupplierSnapshot> {
  const dalam = { gte: start, lte: end };
  const num = (v: unknown) => Number(v ?? 0);

  const faktur = await prisma.fakturPembelian.findMany({
    where: { tanggal: dalam },
    orderBy: [{ supplier: { nama: "asc" } }, { tanggal: "asc" }],
    select: {
      id: true,
      noFaktur: true,
      tanggal: true,
      total: true,
      supplier: { select: { nama: true } },
      items: {
        orderBy: { id: "asc" },
        select: { id: true, deskripsi: true, kuantitas: true, unit: true, harga: true, diskonPersen: true, jumlah: true },
      },
    },
  });

  const grupMap = new Map<string, PembelianGrup>();
  let totalBaris = 0;

  for (const f of faktur) {
    const supplier = f.supplier?.nama?.trim() || "—";
    const g = grupMap.get(supplier) ?? { supplier, baris: [], subtotal: 0 };
    const totalTagihan = Math.round(num(f.total));
    g.subtotal += totalTagihan;
    for (const it of f.items) {
      const diskon = Number(it.diskonPersen ?? 0);
      g.baris.push({
        id: it.id,
        tanggal: f.tanggal.toISOString(),
        tipeTransaksi: "Faktur Pembelian",
        noTransaksi: f.noFaktur,
        produk: it.deskripsi?.trim() || "—",
        keterangan: diskon > 0 ? `Diskon ${diskon}%` : "—",
        qty: num(it.kuantitas),
        unit: it.unit?.trim() || "—",
        harga: Math.round(num(it.harga)),
        nominal: Math.round(num(it.jumlah)),
        totalTagihan,
      });
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
    grandTotal: grup.reduce((s, g) => s + g.subtotal, 0),
    totalBaris,
  };
}
