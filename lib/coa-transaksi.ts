// Helper transaksi per akun COA — kini mengambil dari Buku Besar/Jurnal.
// Dipakai halaman detail akun dan API riwayatnya; hasilnya identik dengan Buku Besar.

import { getBukuBesar } from "@/lib/buku-besar-server";

export type BukuBesarRow = {
  id: string;
  tanggal: string;
  transaksi: string;
  noTransaksi: string | null;
  debit: number;
  kredit: number;
  saldo: number;
};

export type RingkasanAkunBukuBesar = {
  totalDebit: number;
  totalKredit: number;
  saldoAkhir: number;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function getTransaksiAkun(
  kode: string,
  opts: { page?: number; limit?: number; startDate?: Date; endDate?: Date } = {}
): Promise<{ rows: BukuBesarRow[]; total: number; summary: RingkasanAkunBukuBesar }> {
  try {
    return await getTransaksiAkunUnsafe(kode, opts);
  } catch {
    return { rows: [], total: 0, summary: { totalDebit: 0, totalKredit: 0, saldoAkhir: 0 } };
  }
}

async function getTransaksiAkunUnsafe(
  kode: string,
  opts: { page?: number; limit?: number; startDate?: Date; endDate?: Date } = {}
) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 10));

  const start = opts.startDate ? startOfDay(new Date(opts.startDate)) : new Date(1970, 0, 1);
  const end = opts.endDate ? endOfDay(new Date(opts.endDate)) : endOfDay(new Date());

  const snapshot = await getBukuBesar(start, end, kode);
  const akun = snapshot.akun[0];

  const allRows = akun ? akun.baris : [];
  const total = allRows.length;
  const skip = (page - 1) * limit;
  const paged = allRows.slice(skip, skip + limit).reverse(); // terbaru dulu

  const summary: RingkasanAkunBukuBesar = akun
    ? {
        totalDebit: Number(akun.totalDebit) || 0,
        totalKredit: Number(akun.totalKredit) || 0,
        saldoAkhir: Number(akun.saldoAkhir) || 0,
      }
    : { totalDebit: 0, totalKredit: 0, saldoAkhir: 0 };

  return {
    rows: paged.map((b, i) => ({
      id: `${b.tanggal}-${b.noTransaksi ?? '0'}-${i}`,
      tanggal: b.tanggal,
      transaksi: b.transaksi,
      noTransaksi: b.noTransaksi,
      debit: Number(b.debit) || 0,
      kredit: Number(b.kredit) || 0,
      saldo: Number(b.saldo) || 0,
    })),
    total,
    summary,
  };
}
