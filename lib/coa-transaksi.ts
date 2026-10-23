// Helper transaksi per akun COA (KHUSUS server — jangan diimpor Client Component).
// Dipakai halaman detail akun dan API riwayatnya agar angkanya identik.
//
// Untuk akun sumber dana (Kas 1101 / Bank 1103 / Tabungan 1104), TRANSFER
// ikut dihitung: keluar bila akun ini sumbernya, masuk bila akun ini
// tujuannya — rumus yang sama dengan getSaldoPerSumber di halaman Kas & Bank.
// Untuk akun lain, filter kodeAkun seperti semula (TRANSFER tak berkode).

import { prisma } from "@/lib/prisma";
import { SUMBER_DANA_KODE_MAP } from "@/lib/coa-types";
import type { Prisma } from "@/generated/prisma/client";

export type ArahTransaksiAkun = "masuk" | "keluar";

export type TransaksiAkunRow = {
  id: string;
  tanggal: string;
  tipe: string;
  kategori: string;
  kodeAkun: string | null;
  sumberDana: string | null;
  sumberDanaTujuan: string | null;
  jumlah: number;
  keterangan: string | null;
  adminNama: string;
  buktiCount: number;
  /** Arah relatif terhadap akun yang dilihat (untuk tanda + / -). */
  arah: ArahTransaksiAkun;
};

export type RingkasanAkun = {
  pemasukan: number;
  pengeluaran: number;
  saldo: number;
};

export async function getTransaksiAkun(
  kode: string,
  opts: { page?: number; limit?: number; startDate?: Date; endDate?: Date } = {}
): Promise<{ rows: TransaksiAkunRow[]; total: number; summary: RingkasanAkun }> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 10));
  const skip = (page - 1) * limit;

  const sumber = SUMBER_DANA_KODE_MAP[kode];
  const isSumberDana = !!sumber;

  const where: Prisma.TransaksiKasWhereInput = isSumberDana
    ? {
        OR: [
          { sumberDana: sumber, tipe: { in: ["PEMASUKAN", "PENGELUARAN", "TRANSFER"] } },
          { sumberDanaTujuan: sumber, tipe: "TRANSFER" },
        ],
      }
    : { kodeAkun: kode };

  if (opts.startDate || opts.endDate) {
    where.tanggal = {};
    if (opts.startDate) {
      const s = new Date(opts.startDate);
      s.setHours(0, 0, 0, 0);
      where.tanggal.gte = s;
    }
    if (opts.endDate) {
      const e = new Date(opts.endDate);
      e.setHours(23, 59, 59, 999);
      where.tanggal.lte = e;
    }
  }

  const num = (v: unknown) => Math.round(Number(v ?? 0));

  const [rows, total, sums] = await Promise.all([
    prisma.transaksiKas.findMany({
      where,
      skip,
      take: limit,
      orderBy: { tanggal: "desc" },
      include: { admin: { select: { id: true, nama: true } }, _count: { select: { bukti: true } } },
    }),
    prisma.transaksiKas.count({ where }),
    prisma.transaksiKas.groupBy({
      by: ["tipe", "sumberDana", "sumberDanaTujuan"],
      where,
      _sum: { jumlah: true },
    }),
  ]);

  let masuk = 0;
  let keluar = 0;
  for (const s of sums) {
    const v = num(s._sum.jumlah);
    if (s.tipe === "PEMASUKAN") masuk += v;
    else if (s.tipe === "PENGELUARAN") keluar += v;
    else if (s.tipe === "TRANSFER" && isSumberDana) {
      if (s.sumberDanaTujuan === sumber) masuk += v;
      else keluar += v;
    }
  }

  return {
    rows: rows.map((d) => ({
      id: d.id,
      tanggal: d.tanggal.toISOString(),
      tipe: d.tipe,
      kategori: d.kategori,
      kodeAkun: d.kodeAkun,
      sumberDana: d.sumberDana,
      sumberDanaTujuan: d.sumberDanaTujuan,
      jumlah: num(d.jumlah),
      keterangan: d.keterangan,
      adminNama: d.admin.nama,
      buktiCount: d._count.bukti,
      arah:
        d.tipe === "PEMASUKAN"
          ? ("masuk" as const)
          : d.tipe === "PENGELUARAN"
            ? ("keluar" as const)
            : d.sumberDanaTujuan === sumber
              ? ("masuk" as const)
              : ("keluar" as const),
    })),
    total,
    summary: { pemasukan: masuk, pengeluaran: keluar, saldo: masuk - keluar },
  };
}
