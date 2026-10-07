// Service Laporan Daftar Faktur Proforma PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data (semuanya data aktual database, tanpa dummy):
// - DokumenPenjualan tipe PROFORMA pada rentang tanggal + nama Pelanggan.
// - Proforma bukan piutang (hanya PENAGIHAN yang menerbitkan Tagihan), maka:
//   * bila proforma sudah diteruskan menjadi penagihan (dokumen PENAGIHAN yang
//     referensiIds-nya memuat proforma, pola yang sama dengan modul penjualan),
//     sisa = jumlah sisa Tagihan PIUTANG anak-anaknya;
//   * bila belum ada penagihan: sisa = total (DITUTUP/dibatalkan -> 0).
// - Status tampil: DITUTUP -> Cancelled, BELUM_DITAGIH -> Draft,
//   TERBUKA -> Open, SELESAI -> Paid bila seluruh tagihan anak LUNAS
//   (atau tanpa anak), sonst Open.
// - Total dihitung dari SELURUH proforma terfilter (bukan halaman aktif).

import { prisma } from "@/lib/prisma";
import type {
  ProformaPeriode,
  ProformaSnapshot,
  StatusProforma,
} from "@/lib/proforma-invoice-types";

export {
  PROFORMA_PERIODE,
  PROFORMA_PERIODE_LABEL,
  rentangUntukProforma,
} from "@/lib/proforma-invoice-types";
export type {
  ProformaBaris,
  ProformaPeriode,
  ProformaSnapshot,
  StatusProforma,
} from "@/lib/proforma-invoice-types";

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

export function resolveProformaRange(
  periode: ProformaPeriode,
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

export async function getProformaSnapshot(
  start: Date,
  end: Date,
  label: string,
  opts?: { page?: number; limit?: number; paginate?: boolean }
): Promise<ProformaSnapshot> {
  const dalam = { gte: start, lte: end };
  const num = (v: unknown) => Math.round(Number(v ?? 0));
  const page = Math.max(1, opts?.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 10));
  const paginate = opts?.paginate ?? true;

  const docs = await prisma.dokumenPenjualan.findMany({
    where: { tipe: "PROFORMA", tanggal: dalam },
    orderBy: { tanggal: "desc" },
    select: {
      id: true,
      noDokumen: true,
      tanggal: true,
      jatuhTempo: true,
      total: true,
      status: true,
      pelanggan: { select: { nama: true } },
    },
  });

  const ids = docs.map((d) => d.id);
  const anak =
    ids.length > 0
      ? await prisma.dokumenPenjualan.findMany({
          where: { tipe: "PENAGIHAN", referensiIds: { hasSome: ids } },
          select: { referensiIds: true, tagihan: { select: { sisa: true, status: true } } },
        })
      : [];

  const anakPerProforma = new Map<string, { sisa: number; lunasSemua: boolean; ada: boolean }>();
  for (const a of anak) {
    const sisaAnak = a.tagihan ? num(a.tagihan.sisa) : 0;
    const lunas = !a.tagihan || a.tagihan.status === "LUNAS";
    for (const ref of a.referensiIds) {
      if (!ids.includes(ref)) continue;
      const cur = anakPerProforma.get(ref) ?? { sisa: 0, lunasSemua: true, ada: true };
      cur.sisa += sisaAnak;
      cur.lunasSemua = cur.lunasSemua && lunas;
      cur.ada = true;
      anakPerProforma.set(ref, cur);
    }
  }

  const statusOf = (st: string, info?: { sisa: number; lunasSemua: boolean; ada: boolean }): StatusProforma => {
    if (st === "DITUTUP") return "Cancelled";
    if (st === "BELUM_DITAGIH") return "Draft";
    if (st === "TERBUKA") return "Open";
    // SELESAI (diteruskan menjadi penagihan): Paid bila seluruh tagihan anak lunas.
    if (info?.ada) return info.lunasSemua ? "Paid" : "Open";
    return "Open";
  };

  const semua = docs.map((d) => {
    const total = num(d.total);
    const info = anakPerProforma.get(d.id);
    const sisa = d.status === "DITUTUP" ? 0 : (info?.ada ? info.sisa : total);
    return {
      id: d.id,
      tanggal: d.tanggal.toISOString(),
      noTransaksi: d.noDokumen,
      jatuhTempo: d.jatuhTempo ? d.jatuhTempo.toISOString() : null,
      pelanggan: d.pelanggan?.nama?.trim() || "—",
      status: statusOf(d.status, info),
      total,
      sisa,
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
    totalInvoice: semua.reduce((s, b) => s + b.total, 0),
    totalSisa: semua.reduce((s, b) => s + b.sisa, 0),
  };
}
