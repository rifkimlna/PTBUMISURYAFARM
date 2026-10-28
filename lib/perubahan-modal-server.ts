// Service Laporan Perubahan Modal PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data (aktual database, tanpa sumber baru):
// - Jurnal (dari TransaksiKas, Dokumen Penjualan, Faktur Pembelian, Opname, HPP)
//   untuk akun modal 3101/3102/3103 dan SALDO_AWAL Persediaan.
// - getLabaRugi (basis akrual, sama dengan Laba Rugi & Neraca) untuk
//   Laba Periode Berjalan.
// - getNeracaSnapshot untuk validasi Total Modal Pemilik.
// 3104 Laba Ditahan disajikan sesuai Neraca (saldo dari Jurnal + laba bersih
// tahun-tahun sebelumnya); dalam tahun berjalan nilainya 0.
// Prive (3103) kontra-ekuitas: debit mengurangi total.

import { prisma } from "@/lib/prisma";
import { getJurnalSnapshot } from "@/lib/jurnal-server";
import { getLabaRugi } from "@/lib/laba-rugi-common";
import { getNeracaSnapshot } from "@/lib/neraca-server";
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
  const epoch = new Date(1970, 0, 1);

  const [akunDb] = await Promise.all([
    prisma.akunCOA.findMany({ where: { isActive: true }, select: { kode: true, nama: true, kelompok: true } }),
  ]);

  const namaAkun = (kode: string, fallback?: string) =>
    akunDb.find((a) => a.kode === kode)?.nama ?? NAMA_AKUN_FALLBACK[kode] ?? fallback ?? `Akun ${kode}`;

  const openingEnd = new Date(start);
  openingEnd.setDate(openingEnd.getDate() - 1);
  const hasOpening = openingEnd >= epoch;

  const [openingJurnal, periodJurnal] = await Promise.all([
    hasOpening ? getJurnalSnapshot(epoch, openingEnd, periode as any, "") : Promise.resolve({ voucher: [] }),
    getJurnalSnapshot(start, end, periode as any, label),
  ]);

  const aggregate = (vouchers: { legs: { kode: string; debit: number; kredit: number }[] }[]) => {
    const map = new Map<string, { debit: number; kredit: number }>();
    for (const v of vouchers) {
      for (const leg of v.legs) {
        const kode = leg.kode;
        const cur = map.get(kode) ?? { debit: 0, kredit: 0 };
        cur.debit += num(leg.debit);
        cur.kredit += num(leg.kredit);
        map.set(kode, cur);
      }
    }
    return map;
  };

  const openingMap = aggregate(openingJurnal.voucher);
  const periodMap = aggregate(periodJurnal.voucher);

  const getPrevSaldo = (kode: string) => {
    const e = openingMap.get(kode);
    return e ? e.kredit - e.debit : 0;
  };
  const getPeriod = (kode: string) => periodMap.get(kode) ?? { debit: 0, kredit: 0 };

  const buildAccountRow = (kode: string, nama: string): PerubahanModalBaris => {
    const permulaan = getPrevSaldo(kode);
    const { debit, kredit } = getPeriod(kode);
    const pergerakan = kredit - debit;
    return { kode, nama, permulaan, debit, kredit, saldoAkhir: permulaan + pergerakan, pergerakan };
  };

  const rows: PerubahanModalBaris[] = [];

  rows.push(buildAccountRow("3101", namaAkun("3101", "Modal Disetor / Setoran Pemilik (Bapak)")));
  rows.push(buildAccountRow("3102", namaAkun("3102", "Modal Disetor / Setoran Pemilik (Riki)")));
  rows.push(buildAccountRow("3103", namaAkun("3103", "Prive / Penarikan Modal")));

  // 3104 Laba Ditahan - saldo dari Jurnal + laba bersih tahun-tahun sebelumnya.
  // Untuk tahun berjalan nilainya 0 agar konsisten dengan Neraca.
  const saldoPrev3104 = getPrevSaldo("3104");
  const { debit: d3104, kredit: k3104 } = getPeriod("3104");
  const permulaan3104 = saldoPrev3104;
  const saldoAkhir3104 = permulaan3104 + k3104 - d3104;
  // Dalam praktik tahun berjalan, saldo 3104 diharapkan 0.
  rows.push({
    kode: "3104",
    nama: namaAkun("3104", "Laba Ditahan (Akumulasi)"),
    permulaan: permulaan3104,
    debit: d3104,
    kredit: k3104,
    saldoAkhir: saldoAkhir3104,
    pergerakan: k3104 - d3104,
  });

  // Saldo Awal Persediaan - kode khusus SALDO_AWAL dari jurnal opname
  rows.push(
    buildAccountRow("SALDO_AWAL", "Saldo Awal Persediaan")
  );

  // Laba Periode Berjalan dari getLabaRugi (basis akrual)
  const yearStart = new Date(end.getFullYear(), 0, 1);
  const permulaanEnd = new Date(start);
  permulaanEnd.setDate(permulaanEnd.getDate() - 1);

  const [labaPermulaanRes, labaAkhirRes] = await Promise.all([
    permulaanEnd >= yearStart ? getLabaRugi(yearStart, permulaanEnd) : Promise.resolve({ labaBersih: 0 }),
    getLabaRugi(yearStart, end),
  ]);

  const permulaanLaba = num(labaPermulaanRes.labaBersih);
  const saldoAkhirLaba = num(labaAkhirRes.labaBersih);
  const pergerakanLaba = saldoAkhirLaba - permulaanLaba;

  const labaDebit = pergerakanLaba < 0 ? -pergerakanLaba : 0;
  const labaKredit = pergerakanLaba >= 0 ? pergerakanLaba : 0;

  rows.push({
    kode: "LABA_PERIODE",
    nama: "Laba Periode Berjalan",
    permulaan: permulaanLaba,
    debit: labaDebit,
    kredit: labaKredit,
    saldoAkhir: saldoAkhirLaba,
    pergerakan: pergerakanLaba,
  });

  const sum = (f: (b: PerubahanModalBaris) => number) => rows.reduce((s, b) => s + f(b), 0);
  const totalPermulaan = sum((b) => b.permulaan);
  const totalDebit = sum((b) => b.debit);
  const totalKredit = sum((b) => b.kredit);
  const totalSaldoAkhir = sum((b) => b.saldoAkhir);
  const totalPergerakan = totalKredit - totalDebit;

  // Validasi terhadap Neraca
  const neracaPeriodeMap: Record<string, string> = {
    "minggu-ini": "pekan-ini",
    "minggu-lalu": "pekan-lalu",
    "bulan-ini": "bulan-ini",
    "bulan-lalu": "bulan-lalu",
    "tahun-ini": "tahun-ini",
    "tahun-lalu": "tahun-lalu",
    "hari-ini": "hari-ini",
    "kemarin": "kemarin",
    "tanggal": "custom",
  };
  const neracaPeriode = neracaPeriodeMap[periode] ?? "custom";
  const neracaSnap = await getNeracaSnapshot(end, neracaPeriode as any, label, start);
  const totalModalNeraca = neracaSnap.totalModal;

  const catatan: string[] = [];
  catatan.push("Sumber data: Jurnal (TransaksiKas, Dokumen Penjualan, Faktur Pembelian, Opname, HPP) dan getLabaRugi (basis akrual).");
  catatan.push("Laba Periode Berjalan dihitung dari getLabaRugi 1 Jan s/d tanggal akhir periode. Permulaan = laba 1 Jan s/d hari sebelum periode.");
  catatan.push("3104 Laba Ditahan mengikuti saldo Jurnal + laba bersih tahun-tahun sebelumnya; dalam tahun berjalan nilainya 0 dan akan dipindahkan ke 3104 pada penutupan tahun buku.");
  catatan.push("Prive (3103) bersifat kontra-ekuitas: penarikan menambah kolom Debit dan mengurangi Total.");
  catatan.push("Saldo Akhir = Permulaan + Kredit - Debit; Pergerakan = Kredit - Debit.");
  catatan.push("Total Saldo Akhir Perubahan Modal harus sama dengan Total Modal Pemilik di Neraca tanggal yang sama.");

  if (totalSaldoAkhir !== totalModalNeraca) {
    const selisih = totalSaldoAkhir - totalModalNeraca;
    catatan.push(`PERINGATAN: Total Saldo Akhir Perubahan Modal Rp ${totalSaldoAkhir.toLocaleString("id-ID")} ≠ Total Modal Pemilik Neraca Rp ${totalModalNeraca.toLocaleString("id-ID")}. Selisih Rp ${Math.abs(selisih).toLocaleString("id-ID")}. Tidak dilakukan penyesuaian otomatis.`);
  } else {
    catatan.push(`Validasi Neraca OK: Total Saldo Akhir Rp ${totalSaldoAkhir.toLocaleString("id-ID")} = Total Modal Pemilik Neraca.`);
  }

  return {
    periode,
    start: start.toISOString(),
    end: end.toISOString(),
    label,
    baris: rows,
    totalPermulaan,
    totalDebit,
    totalKredit,
    totalSaldoAkhir,
    totalPergerakan,
    catatan,
  };
}
