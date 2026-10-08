// Service Laporan Daftar Penjualan PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data (semuanya data aktual database, tanpa dummy):
// - DokumenPenjualan tipe PENAGIHAN (= Faktur Penjualan) pada rentang tanggal.
// - Nama pelanggan dari relasi Pelanggan; sisa & status dari Tagihan PIUTANG
//   tertaut (BELUM_LUNAS -> Belum Dibayar, LUNAS_SEBAGIAN -> Sebagian Dibayar,
//   LUNAS -> Sudah Dibayar). Tanpa tagihan: sisa = total, Belum Dibayar.
// - Total transaksi & total sisa dihitung dari SELURUH baris terfilter
//   (bukan hanya halaman aktif).

import { prisma } from "@/lib/prisma";
import type {
  DaftarPenjualanBaris,
  DaftarPenjualanPeriode,
  DaftarPenjualanSnapshot,
  StatusPembayaranPenjualan,
} from "@/lib/daftar-penjualan-types";

export {
  DAFTAR_PENJUALAN_PERIODE,
  DAFTAR_PENJUALAN_PERIODE_LABEL,
} from "@/lib/daftar-penjualan-types";
export type {
  DaftarPenjualanBaris,
  DaftarPenjualanFilter,
  DaftarPenjualanPeriode,
  DaftarPenjualanSnapshot,
  StatusPembayaranPenjualan,
} from "@/lib/daftar-penjualan-types";

// ---------- Rentang periode (kalender lokal, pola yang sama dengan Jurnal) ----------

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

export function resolveDaftarPenjualanRange(
  periode: DaftarPenjualanPeriode,
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
    case "pekan-ini": {
      const dow = (today.getDay() + 6) % 7; // Senin = 0
      const s = addDays(today, -dow);
      const e = addDays(s, 6);
      return { start: s, end: endOfDay(e), label: `${fmtTgl(s)} – ${fmtTgl(e)}` };
    }
    case "pekan-lalu": {
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

const STATUS_MAP: Record<string, StatusPembayaranPenjualan> = {
  BELUM_LUNAS: "Belum Dibayar",
  LUNAS_SEBAGIAN: "Sebagian Dibayar",
  LUNAS: "Sudah Dibayar",
};

export async function getDaftarPenjualanSnapshot(
  start: Date,
  end: Date,
  label: string,
  opts?: { page?: number; limit?: number; paginate?: boolean }
): Promise<DaftarPenjualanSnapshot> {
  const dalam = { gte: start, lte: end };
  const num = (v: unknown) => Math.round(Number(v ?? 0));

  const where = { tipe: "PENAGIHAN" as const, tanggal: dalam };
  const page = Math.max(1, opts?.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 10));
  const paginate = opts?.paginate ?? true;

  const [total, rows] = await Promise.all([
    prisma.dokumenPenjualan.count({ where }),
    prisma.dokumenPenjualan.findMany({
      where,
      orderBy: { tanggal: "desc" },
      ...(paginate ? { skip: (page - 1) * limit, take: limit } : {}),
      select: {
        id: true,
        noDokumen: true,
        tanggal: true,
        memo: true,
        pesan: true,
        total: true,
        pelanggan: { select: { nama: true } },
        tagihan: { select: { sisa: true, status: true } },
      },
    }),
  ]);

  const baris: DaftarPenjualanBaris[] = rows.map((d) => {
    const totalNum = num(d.total);
    return {
      id: d.id,
      tanggal: d.tanggal.toISOString(),
      tipeTransaksi: "Faktur Penjualan",
      noTransaksi: d.noDokumen,
      pelanggan: d.pelanggan?.nama ?? "—",
      status: (d.tagihan ? STATUS_MAP[d.tagihan.status] : undefined) ?? "Belum Dibayar",
      memo: d.memo?.trim() || d.pesan?.trim() || "—",
      total: totalNum,
      sisa: d.tagihan ? num(d.tagihan.sisa) : totalNum,
    };
  });

  // Total transaksi & total sisa dari SELURUH baris terfilter (bukan halaman).
  const semua = await prisma.dokumenPenjualan.findMany({
    where,
    select: { total: true, tagihan: { select: { sisa: true } } },
  });
  const totalTransaksi = semua.reduce((s, d) => s + num(d.total), 0);
  const totalSisa = semua.reduce((s, d) => s + (d.tagihan ? num(d.tagihan.sisa) : num(d.total)), 0);

  return {
    label,
    start: start.toISOString(),
    end: end.toISOString(),
    baris,
    total,
    totalTransaksi,
    totalSisa,
  };
}
