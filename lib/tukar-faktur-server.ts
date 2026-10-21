// Service Laporan Daftar Tukar Faktur PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data (semuanya data aktual database, tanpa dummy):
// - DokumenPenjualan tipe TUKAR_FAKTUR pada rentang tanggal + nama Pelanggan.
// - Tukar faktur tidak punya nilai sendiri (tanpa piutang/Kas baru), maka kolom
//   nilai diambil dari faktur yang dirujuk (Tagihan PIUTANG pada referensiIds):
//   total rujukan = jumlah tagihan dirujuk, sisa rujukan = sisa tagihan dirujuk.
// - Status tampil: DITUTUP -> Dibatalkan, SELESAI -> Selesai, lainnya -> Terbuka.
// - Total dihitung dari SELURUH tukar faktur terfilter (bukan halaman aktif).

import { prisma } from "@/lib/prisma";
import type {
  TukarFakturPeriode,
  TukarFakturSnapshot,
  StatusTukarFaktur,
} from "@/lib/tukar-faktur-types";

export {
  TUKAR_FAKTUR_PERIODE,
  TUKAR_FAKTUR_PERIODE_LABEL,
  rentangUntukTukarFaktur,
} from "@/lib/tukar-faktur-types";
export type {
  TukarFakturBaris,
  TukarFakturPeriode,
  TukarFakturSnapshot,
  StatusTukarFaktur,
} from "@/lib/tukar-faktur-types";

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

export function resolveTukarFakturRange(
  periode: TukarFakturPeriode,
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

export async function getTukarFakturSnapshot(
  start: Date,
  end: Date,
  label: string,
  opts?: { page?: number; limit?: number; paginate?: boolean }
): Promise<TukarFakturSnapshot> {
  const dalam = { gte: start, lte: end };
  const num = (v: unknown) => Math.round(Number(v ?? 0));
  const page = Math.max(1, opts?.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 10));
  const paginate = opts?.paginate ?? true;

  const docs = await prisma.dokumenPenjualan.findMany({
    where: { tipe: "TUKAR_FAKTUR", tanggal: dalam },
    orderBy: { tanggal: "desc" },
    select: {
      id: true,
      noDokumen: true,
      tanggal: true,
      jatuhTempo: true,
      total: true,
      status: true,
      referensiIds: true,
      pelanggan: { select: { nama: true } },
    },
  });

  // Faktur yang dirujuk (Tagihan PIUTANG) untuk kolom nilai.
  const semuaRefIds = [...new Set(docs.flatMap((d) => d.referensiIds))];
  const rujukan =
    semuaRefIds.length > 0
      ? await prisma.tagihan.findMany({
          where: { id: { in: semuaRefIds } },
          select: { id: true, noInvoice: true, jumlah: true, sisa: true },
        })
      : [];
  const rujukanById = new Map(rujukan.map((r) => [r.id, r]));

  const statusOf = (st: string): StatusTukarFaktur => {
    if (st === "DITUTUP") return "Dibatalkan";
    if (st === "SELESAI") return "Selesai";
    return "Terbuka";
  };

  const semua = docs.map((d) => {
    const refs = d.referensiIds
      .map((id) => rujukanById.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
    const totalRujukan = refs.reduce((s, r) => s + num(r.jumlah), 0);
    const sisaRujukan = refs.reduce((s, r) => s + num(r.sisa), 0);
    return {
      id: d.id,
      tanggal: d.tanggal.toISOString(),
      noTransaksi: d.noDokumen,
      jatuhTempo: d.jatuhTempo ? d.jatuhTempo.toISOString() : null,
      pelanggan: d.pelanggan?.nama?.trim() || "—",
      rujukan: refs.map((r) => r.noInvoice ?? `…${r.id.slice(-6).toUpperCase()}`).join(", ") || "—",
      status: statusOf(d.status),
      totalRujukan,
      sisaRujukan,
      mataUang: "IDR",
    };
  });

  const slice = paginate ? semua.slice((page - 1) * limit, page * limit) : semua;

  return {
    label,
    start: start.toISOString(),
    end: end.toISOString(),
    baris: slice,
    total: semua.length,
    totalRujukan: semua.reduce((s, b) => s + b.totalRujukan, 0),
    totalSisaRujukan: semua.reduce((s, b) => s + b.sisaRujukan, 0),
  };
}
