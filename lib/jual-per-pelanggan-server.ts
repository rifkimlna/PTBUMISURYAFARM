// Service Laporan Penjualan per Pelanggan PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data (semuanya data aktual database, tanpa dummy):
// - DokumenPenjualan tipe PENAGIHAN (= Sales Invoice) pada rentang tanggal.
// - Relasi Customer -> Sales Invoice -> Invoice Detail (items: deskripsi,
//   kuantitas, unit, harga, jumlah). Keterangan baris = info diskon item
//   bila ada, sonst "—".
// - Dikelompokkan per pelanggan + subtotal per pelanggan + grand total
//   (dari total invoice, bukan penjumlahan baris item).

import { prisma } from "@/lib/prisma";
import type {
  JualGrup,
  JualPerPelangganPeriode,
  JualPerPelangganSnapshot,
} from "@/lib/jual-per-pelanggan-types";

export {
  JUAL_PER_PELANGGAN_PERIODE,
  JUAL_PER_PELANGGAN_PERIODE_LABEL,
  rentangUntukJualPerPelanggan,
} from "@/lib/jual-per-pelanggan-types";
export type {
  JualGrup,
  JualItemBaris,
  JualPerPelangganPeriode,
  JualPerPelangganSnapshot,
} from "@/lib/jual-per-pelanggan-types";

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

export function resolveJualPerPelangganRange(
  periode: JualPerPelangganPeriode,
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

export async function getJualPerPelangganSnapshot(
  start: Date,
  end: Date,
  label: string
): Promise<JualPerPelangganSnapshot> {
  const dalam = { gte: start, lte: end };
  const num = (v: unknown) => Number(v ?? 0);

  const docs = await prisma.dokumenPenjualan.findMany({
    where: { tipe: "PENAGIHAN", tanggal: dalam },
    orderBy: [{ pelanggan: { nama: "asc" } }, { tanggal: "asc" }],
    select: {
      id: true,
      noDokumen: true,
      tanggal: true,
      total: true,
      pelanggan: { select: { nama: true } },
      items: {
        orderBy: { id: "asc" },
        select: { id: true, deskripsi: true, kuantitas: true, unit: true, harga: true, diskonPersen: true, jumlah: true },
      },
    },
  });

  const grupMap = new Map<string, JualGrup>();
  let totalBaris = 0;

  for (const d of docs) {
    const pelanggan = d.pelanggan?.nama?.trim() || "—";
    const g = grupMap.get(pelanggan) ?? { pelanggan, baris: [], subtotal: 0 };
    const totalTagihan = Math.round(num(d.total));
    g.subtotal += totalTagihan;
    for (const it of d.items) {
      const diskon = Number(it.diskonPersen ?? 0);
      g.baris.push({
        id: it.id,
        tanggal: d.tanggal.toISOString(),
        tipeTransaksi: "Invoice",
        noTransaksi: d.noDokumen,
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
    grupMap.set(pelanggan, g);
  }

  const grup = [...grupMap.values()].sort((a, b) => a.pelanggan.localeCompare(b.pelanggan, "id"));
  return {
    label,
    start: start.toISOString(),
    end: end.toISOString(),
    grup,
    grandTotal: grup.reduce((s, g) => s + g.subtotal, 0),
    totalBaris,
  };
}
