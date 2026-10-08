// Service Laporan Neraca Saldo / Trial Balance PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data (aktual database, tanpa sumber baru / tanpa dummy):
// - Agregat kaki jurnal (voucher TransaksiKas via getJurnalSnapshot) per akun
//   dalam periode: setiap voucher seimbang (debit = kredit), sehingga total
//   debit selalu sama dengan total kredit dan dapat dibandingkan langsung.
// - Nama/kelompok akun dari tabel AkunCOA.

import { prisma } from "@/lib/prisma";
import { getJurnalSnapshot } from "@/lib/jurnal-server";
import type {
  NeracaSaldoPeriode,
  NeracaSaldoSnapshot,
} from "@/lib/neraca-saldo-types";

export { NERACA_SALDO_PERIODE, NERACA_SALDO_PERIODE_LABEL } from "@/lib/neraca-saldo-types";
export type { NeracaSaldoBaris, NeracaSaldoPeriode, NeracaSaldoSnapshot } from "@/lib/neraca-saldo-types";

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

export function resolveNeracaSaldoRange(
  periode: NeracaSaldoPeriode,
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

// ---------- Penyusunan neraca saldo ----------

const KELOMPOK_URUTAN = ["Aset", "Kewajiban", "Ekuitas", "Pendapatan", "Beban"];
/** Label tampil: enum COA memakai `Modal`, laporan memakai `Ekuitas`. */
const KELOMPOK_TAMPIL: Record<string, string> = {
  Aset: "Aset",
  Kewajiban: "Kewajiban",
  Modal: "Ekuitas",
  Pendapatan: "Pendapatan",
  Beban: "Beban",
};
const AWAL_EPOCH = new Date(2000, 0, 1);

type VoucherRingkas = { legs: { kode: string; nama: string; debit: number; kredit: number }[] };

function agregatKaki(voucher: VoucherRingkas[]) {
  const agg = new Map<string, { nama: string; debit: number; kredit: number }>();
  for (const v of voucher) {
    for (const l of v.legs) {
      const cur = agg.get(l.kode) ?? { nama: l.nama, debit: 0, kredit: 0 };
      cur.nama = cur.nama || l.nama;
      cur.debit += Math.round(Number(l.debit) || 0);
      cur.kredit += Math.round(Number(l.kredit) || 0);
      agg.set(l.kode, cur);
    }
  }
  return agg;
}

export async function getNeracaSaldoSnapshot(
  start: Date,
  end: Date,
  periode: NeracaSaldoPeriode,
  label: string
): Promise<NeracaSaldoSnapshot> {
  const [jurnal, akunDb] = await Promise.all([
    getJurnalSnapshot(start, end, "bulan-ini", label),
    prisma.akunCOA.findMany({ select: { kode: true, nama: true, kelompok: true } }),
  ]);

  // Saldo awal = agregat seluruh voucher jurnal SEBELUM periode (data asli,
  // sumber ganda yang sama dengan pergerakan — tanpa dummy).
  const awalEnd = new Date(start.getTime() - 1);
  let voucherAwal: VoucherRingkas[] = [];
  if (awalEnd >= AWAL_EPOCH) {
    const jurnalAwal = await getJurnalSnapshot(AWAL_EPOCH, awalEnd, "bulan-ini", label);
    voucherAwal = jurnalAwal.voucher;
  }

  const aggAwal = agregatKaki(voucherAwal);
  const aggGerak = agregatKaki(jurnal.voucher);

  const meta = new Map(akunDb.map((a) => [a.kode, a]));
  const kodeSet = new Set<string>([...aggAwal.keys(), ...aggGerak.keys()]);
  // Akun bersaldo nol & tak bermutasi tidak ditampilkan; akun dari master
  // tanpa mutasi juga tidak ditampilkan (konsisten dengan perilaku lama).

  const semuaBaris = [...kodeSet].map((kode) => {
    const m = meta.get(kode);
    const a = aggAwal.get(kode);
    const g = aggGerak.get(kode);
    const nama = m?.nama ?? a?.nama ?? g?.nama ?? `Akun ${kode}`;
    const kelompokRaw = m?.kelompok ?? "";
    const kelompok = KELOMPOK_TAMPIL[kelompokRaw] ?? kelompokRaw ?? "";
    const awalNet = (a?.debit ?? 0) - (a?.kredit ?? 0);
    const gerakD = g?.debit ?? 0;
    const gerakK = g?.kredit ?? 0;
    const akhirNet = awalNet + (gerakD - gerakK);
    return {
      kode,
      nama,
      kelompok,
      saldoAwalDebit: awalNet > 0 ? awalNet : 0,
      saldoAwalKredit: awalNet < 0 ? -awalNet : 0,
      debit: gerakD,
      kredit: gerakK,
      akhirDebit: akhirNet > 0 ? akhirNet : 0,
      akhirKredit: akhirNet < 0 ? -akhirNet : 0,
    };
  })
    .filter(
      (b) =>
        b.saldoAwalDebit !== 0 ||
        b.saldoAwalKredit !== 0 ||
        b.debit !== 0 ||
        b.kredit !== 0 ||
        b.akhirDebit !== 0 ||
        b.akhirKredit !== 0
    )
    .sort((a, b) => {
      const ia = KELOMPOK_URUTAN.indexOf(a.kelompok);
      const ib = KELOMPOK_URUTAN.indexOf(b.kelompok);
      if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return a.kode.localeCompare(b.kode);
    });

  const jumlahkan = (rows: typeof semuaBaris) => ({
    totalAwalDebit: rows.reduce((s, b) => s + b.saldoAwalDebit, 0),
    totalAwalKredit: rows.reduce((s, b) => s + b.saldoAwalKredit, 0),
    totalDebit: rows.reduce((s, b) => s + b.debit, 0),
    totalKredit: rows.reduce((s, b) => s + b.kredit, 0),
    totalAkhirDebit: rows.reduce((s, b) => s + b.akhirDebit, 0),
    totalAkhirKredit: rows.reduce((s, b) => s + b.akhirKredit, 0),
  });

  const grup = KELOMPOK_URUTAN.map((nama) => {
    const rows = semuaBaris.filter((b) => b.kelompok === nama);
    return { nama, baris: rows, ...jumlahkan(rows) };
  }).filter((g) => g.baris.length > 0);

  const grand = jumlahkan(semuaBaris);

  const catatan: string[] = [
    "Angka merupakan agregat kaki jurnal (debit/kredit) dari data TransaksiKas asli — setiap voucher seimbang.",
    "Saldo awal = akumulasi jurnal sebelum periode; Pergerakan = jurnal dalam periode; Saldo akhir = saldo awal + pergerakan.",
    "Kelompok Modal pada COA ditampilkan sebagai Ekuitas. Hanya akun bersaldo atau bermutasi yang ditampilkan.",
  ];

  return {
    periode,
    start: start.toISOString(),
    end: end.toISOString(),
    label,
    baris: semuaBaris,
    grup,
    ...grand,
    seimbang:
      grand.totalAwalDebit === grand.totalAwalKredit &&
      grand.totalDebit === grand.totalKredit &&
      grand.totalAkhirDebit === grand.totalAkhirKredit,
    catatan,
  };
}
