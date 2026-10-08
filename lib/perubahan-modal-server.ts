// Service Laporan Perubahan Modal PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data (semuanya data aktual database, tanpa sumber baru):
// - AkunCOA kelompok "Modal" (3101/3102 setoran, 3103 prive, 3104 laba
//   ditahan, plus akun modal lain bila pengguna menambah via master COA).
// - TransaksiKas berkode akun 31xx (TRANSFER dikecualikan, konsisten dengan
//   Neraca & Arus Kas): PEMASUKAN = penambah (kredit), PENGELUARAN = pengurang
//   (debit). Permulaan = kumulatif s/d sehari sebelum periode.
// - 3104 "Laba Ditahan": permulaan = laba basis kas kumulatif sebelum periode
//   (PEMASUKAN − PENGELUARAN non-transfer, konsisten dengan angka 3104 di
//   Neraca); mutasi periode = pemasukan (kredit) vs pengeluaran (debit).
//   Saldo Akhir = Permulaan + Kredit − Debit; Pergerakan = Kredit − Debit.
// - Prive (3103) disajikan dengan rumus yang sama sehingga saldonya negatif
//   (kontra-ekuitas) dan otomatis mengurangi Total.

import { prisma } from "@/lib/prisma";
import type {
  PerubahanModalBaris,
  PerubahanModalPeriode,
  PerubahanModalSnapshot,
} from "@/lib/perubahan-modal-types";

export { PERUBAHAN_MODAL_PERIODE, PERUBAHAN_MODAL_PERIODE_LABEL } from "@/lib/perubahan-modal-types";
export type { PerubahanModalBaris, PerubahanModalPeriode, PerubahanModalSnapshot } from "@/lib/perubahan-modal-types";

// ---------- Rentang periode (kalender lokal, pola yang sama dengan laporan lain) ----------

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

export function resolvePerubahanModalRange(
  periode: PerubahanModalPeriode,
  tanggal?: string,
  dari?: string,
  sampai?: string
): { start: Date; end: Date; label: string } {
  const now = new Date();
  const today = startOfDay(now);

  switch (periode) {
    case "tanggal": {
      // Satu hari yang dipilih pengguna (dari/sampai didukung untuk kompatibilitas query unduhan).
      const raw = tanggal ?? dari ?? sampai;
      if (!raw) throw new Error("Periode tanggal membutuhkan tanggal yang dipilih");
      const s = startOfDay(new Date(raw));
      if (Number.isNaN(s.getTime())) throw new Error("Tanggal tidak valid");
      return { start: s, end: endOfDay(s), label: fmtTgl(s) };
    }
    case "hari-ini":
      return { start: today, end: endOfDay(today), label: fmtTgl(today) };
    case "kemarin": {
      const y = addDays(today, -1);
      return { start: y, end: endOfDay(y), label: fmtTgl(y) };
    }
    case "minggu-ini": {
      const dow = (today.getDay() + 6) % 7; // Senin = 0
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
  }
}

const NAMA_AKUN_FALLBACK: Record<string, string> = {
  "3101": "Modal Disetor / Setoran Pemilik (Bapak)",
  "3102": "Modal Disetor / Setoran Pemilik (Riki)",
  "3103": "Prive / Penarikan Modal",
  "3104": "Laba Ditahan (Akumulasi)",
};

// ---------- Perhitungan snapshot ----------

export async function getPerubahanModalSnapshot(
  start: Date,
  end: Date,
  periode: PerubahanModalPeriode,
  label: string
): Promise<PerubahanModalSnapshot> {
  const num = (v: unknown) => Math.round(Number(v ?? 0));

  const [akunModal, kas31Awal, kas31Periode, labaAwal, labaPeriode] = await Promise.all([
    prisma.akunCOA.findMany({
      where: { kelompok: "Modal", isActive: true },
      select: { kode: true, nama: true },
    }),
    prisma.transaksiKas.groupBy({
      by: ["kodeAkun", "tipe"],
      where: {
        kodeAkun: { startsWith: "31" },
        tipe: { in: ["PEMASUKAN", "PENGELUARAN"] },
        tanggal: { lt: start },
      },
      _sum: { jumlah: true },
    }),
    prisma.transaksiKas.groupBy({
      by: ["kodeAkun", "tipe"],
      where: {
        kodeAkun: { startsWith: "31" },
        tipe: { in: ["PEMASUKAN", "PENGELUARAN"] },
        tanggal: { gte: start, lte: end },
      },
      _sum: { jumlah: true },
    }),
    // Laba basis kas kumulatif sebelum periode (untuk permulaan 3104).
    prisma.transaksiKas.groupBy({
      by: ["tipe"],
      where: { tipe: { in: ["PEMASUKAN", "PENGELUARAN"] }, tanggal: { lt: start } },
      _sum: { jumlah: true },
    }),
    // Pemasukan/pengeluaran dalam periode (untuk mutasi 3104).
    prisma.transaksiKas.groupBy({
      by: ["tipe"],
      where: { tipe: { in: ["PEMASUKAN", "PENGELUARAN"] }, tanggal: { gte: start, lte: end } },
      _sum: { jumlah: true },
    }),
  ]);

  const namaAkun = (kode: string) =>
    akunModal.find((a) => a.kode === kode)?.nama ?? NAMA_AKUN_FALLBACK[kode] ?? `Akun ${kode}`;

  // Daftar kode ekuitas: semua akun modal aktif + 3101..3104 (fallback bila belum ada di DB).
  const kodeSet = new Set<string>(akunModal.map((a) => a.kode));
  for (const k of ["3101", "3102", "3103", "3104"]) kodeSet.add(k);
  const kodeList = [...kodeSet].sort();

  const agg = (
    rows: { kodeAkun: string | null; tipe: string; _sum: { jumlah: unknown } }[],
    kode: string,
    tipe: "PEMASUKAN" | "PENGELUARAN"
  ) => num(rows.find((r) => r.kodeAkun === kode && r.tipe === tipe)?._sum.jumlah);

  const labaOf = (rows: { tipe: string; _sum: { jumlah: unknown } }[]) =>
    num(rows.find((r) => r.tipe === "PEMASUKAN")?._sum.jumlah) -
    num(rows.find((r) => r.tipe === "PENGELUARAN")?._sum.jumlah);

  const kreditOf = (rows: { tipe: string; _sum: { jumlah: unknown } }[]) =>
    num(rows.find((r) => r.tipe === "PEMASUKAN")?._sum.jumlah);
  const debitOf = (rows: { tipe: string; _sum: { jumlah: unknown } }[]) =>
    num(rows.find((r) => r.tipe === "PENGELUARAN")?._sum.jumlah);

  const labaPermulaan = labaOf(labaAwal);
  const kreditLaba = kreditOf(labaPeriode);
  const debitLaba = debitOf(labaPeriode);

  const baris: PerubahanModalBaris[] = kodeList.map((kode) => {
    if (kode === "3104") {
      const pergerakan = kreditLaba - debitLaba;
      return {
        kode,
        nama: namaAkun(kode),
        permulaan: labaPermulaan,
        debit: debitLaba,
        kredit: kreditLaba,
        saldoAkhir: labaPermulaan + pergerakan,
        pergerakan,
      };
    }
    const permulaan = agg(kas31Awal, kode, "PEMASUKAN") - agg(kas31Awal, kode, "PENGELUARAN");
    const kredit = agg(kas31Periode, kode, "PEMASUKAN");
    const debit = agg(kas31Periode, kode, "PENGELUARAN");
    const pergerakan = kredit - debit;
    return { kode, nama: namaAkun(kode), permulaan, debit, kredit, saldoAkhir: permulaan + pergerakan, pergerakan };
  });

  const sum = (f: (b: PerubahanModalBaris) => number) => baris.reduce((s, b) => s + f(b), 0);
  const totalPermulaan = sum((b) => b.permulaan);
  const totalDebit = sum((b) => b.debit);
  const totalKredit = sum((b) => b.kredit);
  const totalSaldoAkhir = sum((b) => b.saldoAkhir);
  const totalPergerakan = totalKredit - totalDebit;

  const adaSetoran = baris.some((b) => b.kode !== "3104" && (b.permulaan !== 0 || b.debit !== 0 || b.kredit !== 0));

  const catatan: string[] = [];
  if (!adaSetoran) {
    catatan.push(
      "Belum ada setoran/penarikan modal berkode akun 31xx pada TransaksiKas, sehingga 3101–3103 disajikan Rp 0."
    );
  } else {
    catatan.push("Mutasi 3101–3103 berasal dari TransaksiKas berkode akun 31xx (TRANSFER antar kas dikecualikan).");
  }
  catatan.push(
    "3104 Laba Ditahan memakai laba basis kas (PEMASUKAN − PENGELUARAN non-transfer), konsisten dengan angka 3104 pada Neraca."
  );
  catatan.push("Prive (3103) bersifat kontra-ekuitas: penarikan menambah kolom Debit dan mengurangi Total.");
  catatan.push("Saldo Akhir = Permulaan + Kredit − Debit; Pergerakan = Kredit − Debit.");

  return {
    periode,
    start: start.toISOString(),
    end: end.toISOString(),
    label,
    baris,
    totalPermulaan,
    totalDebit,
    totalKredit,
    totalSaldoAkhir,
    totalPergerakan,
    catatan,
  };
}
