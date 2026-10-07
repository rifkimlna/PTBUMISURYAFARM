// Service Laporan Penyelesaian Pemesanan Penjualan PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data (semuanya data aktual database, tanpa dummy):
// - DokumenPenjualan tipe PESANAN (= Sales Order) pada rentang tanggal.
// - Jumlah Pengiriman: nilai item PengirimanPenjualan yang merujuk pesanan.
// - Jumlah Faktur: total DokumenPenjualan PENAGIHAN yang referensiIds-nya
//   memuat pesanan (pola yang sama dengan modul penjualan).
// - Jumlah Pembayaran: TransaksiKas pada Tagihan PIUTANG faktur-faktur itu.
// - Status tampil dipetakan dari status sistem (BELUM_DITAGIH -> Menunggu,
//   TERBUKA -> Diproses, SELESAI -> Selesai, DITUTUP -> Dibatalkan).
// - Total dihitung dari SELURUH pesanan terfilter (bukan halaman aktif).

import { prisma } from "@/lib/prisma";
import type {
  PenyelesaianPeriode,
  PenyelesaianSnapshot,
  StatusPemesanan,
} from "@/lib/penyelesaian-pemesanan-types";

export {
  PENYELESAIAN_PERIODE,
  PENYELESAIAN_PERIODE_LABEL,
  rentangUntukPenyelesaian,
} from "@/lib/penyelesaian-pemesanan-types";
export type {
  PenyelesaianBaris,
  PenyelesaianPeriode,
  PenyelesaianSnapshot,
  StatusPemesanan,
} from "@/lib/penyelesaian-pemesanan-types";

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

export function resolvePenyelesaianRange(
  periode: PenyelesaianPeriode,
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

const STATUS_MAP: Record<string, StatusPemesanan> = {
  BELUM_DITAGIH: "Menunggu",
  TERBUKA: "Diproses",
  SELESAI: "Selesai",
  DITUTUP: "Dibatalkan",
};

export async function getPenyelesaianSnapshot(
  start: Date,
  end: Date,
  label: string,
  opts?: { page?: number; limit?: number; paginate?: boolean }
): Promise<PenyelesaianSnapshot> {
  const dalam = { gte: start, lte: end };
  const num = (v: unknown) => Math.round(Number(v ?? 0));
  const page = Math.max(1, opts?.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 10));
  const paginate = opts?.paginate ?? true;

  const pesanan = await prisma.dokumenPenjualan.findMany({
    where: { tipe: "PESANAN", tanggal: dalam },
    orderBy: { tanggal: "desc" },
    select: { id: true, noDokumen: true, tanggal: true, total: true, status: true },
  });

  const ids = pesanan.map((p) => p.id);

  const [kirim, faktur] = await Promise.all([
    ids.length > 0
      ? prisma.pengirimanPenjualan.findMany({
          where: { pesananId: { in: ids } },
          select: { pesananId: true, items: { select: { jumlah: true } } },
        })
      : Promise.resolve([]),
    ids.length > 0
      ? prisma.dokumenPenjualan.findMany({
          where: { tipe: "PENAGIHAN", referensiIds: { hasSome: ids } },
          select: { id: true, total: true, tagihanId: true, referensiIds: true },
        })
      : Promise.resolve([]),
  ]);

  const tagihanIds = [...new Set(faktur.map((f) => f.tagihanId).filter(Boolean))] as string[];
  const bayar = tagihanIds.length > 0
    ? await prisma.transaksiKas.findMany({
        where: { tagihanId: { in: tagihanIds } },
        select: { tagihanId: true, jumlah: true },
      })
    : [];
  const bayarPerTagihan = new Map<string, number>();
  for (const b of bayar) {
    if (!b.tagihanId) continue;
    bayarPerTagihan.set(b.tagihanId, (bayarPerTagihan.get(b.tagihanId) ?? 0) + num(b.jumlah));
  }

  const kirimPerPesanan = new Map<string, number>();
  for (const k of kirim) {
    const nilai = k.items.reduce((s, i) => s + num(i.jumlah), 0);
    kirimPerPesanan.set(k.pesananId, (kirimPerPesanan.get(k.pesananId) ?? 0) + nilai);
  }

  const fakturPerPesanan = new Map<string, { total: number; bayar: number }>();
  for (const f of faktur) {
    const bayarFaktur = f.tagihanId ? (bayarPerTagihan.get(f.tagihanId) ?? 0) : 0;
    for (const ref of f.referensiIds) {
      if (!ids.includes(ref)) continue;
      const cur = fakturPerPesanan.get(ref) ?? { total: 0, bayar: 0 };
      cur.total += num(f.total);
      cur.bayar += bayarFaktur;
      fakturPerPesanan.set(ref, cur);
    }
  }

  const semua = pesanan.map((p) => {
    const fk = fakturPerPesanan.get(p.id) ?? { total: 0, bayar: 0 };
    return {
      id: p.id,
      tanggal: p.tanggal.toISOString(),
      noPemesanan: p.noDokumen,
      jumlahPemesanan: num(p.total),
      status: STATUS_MAP[p.status] ?? "Menunggu",
      jumlahPengiriman: kirimPerPesanan.get(p.id) ?? 0,
      jumlahFaktur: fk.total,
      jumlahPembayaran: fk.bayar,
    };
  });

  const slice = paginate ? semua.slice((page - 1) * limit, page * limit) : semua;

  return {
    label,
    start: start.toISOString(),
    end: end.toISOString(),
    baris: slice,
    total: semua.length,
    totalPemesanan: semua.reduce((s, b) => s + b.jumlahPemesanan, 0),
    totalPengiriman: semua.reduce((s, b) => s + b.jumlahPengiriman, 0),
    totalFaktur: semua.reduce((s, b) => s + b.jumlahFaktur, 0),
    totalPembayaran: semua.reduce((s, b) => s + b.jumlahPembayaran, 0),
  };
}
