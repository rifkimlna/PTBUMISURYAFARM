// Service Laporan Arus Kas PT Bumi Surya Farm (KHUSUS modul Laporan Arus Kas).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Seluruh arus berasal dari TransaksiKas (sumber data yang sudah ada, tanpa
// sumber baru). TRANSFER antar Kas/Bank/Tabungan dikecualikan dari arus
// (perpindahan internal, konsisten dengan dashboard & Neraca).
//
// Klasifikasi (berdasarkan pencatatan aktual sistem):
// - Operasional MASUK: seluruh PEMASUKAN non-transfer (penjualan tunai,
//   penerimaan piutang, pendapatan lain) per kode akun COA.
// - Operasional KELUAR: PENGELUARAN non-transfer per kode akun, kecuali kaki
//   investasi & pendanaan (agar tidak ganda).
// - Investasi: kaki akuisisi aset (Aset.transaksiKasId / kode 12xx). Hasil
//   penjualan aset (kas 12xx masuk) bila dicatat.
// - Keuangan/Pendanaan: pelunasan utang (kas bertagihan / kode 5501).
// - Revaluasi Bank: Rp 0 (sistem tidak mencatat selisih kurs) + catatan.
// - Saldo Awal: posisi kas kumulatif SEBELUM periode (transfer-aware per
//   sumber, sama dengan logic Neraca). Saldo Akhir = Awal + Kenaikan.

import { prisma } from "@/lib/prisma";
import { getJurnalSnapshot } from "@/lib/jurnal-server";
import { getNeracaSnapshot } from "@/lib/neraca-server";
import type {
  ArusKasKelompok,
  ArusKasPeriode,
  ArusKasSnapshot,
  SaldoSumber,
} from "@/lib/arus-kas-types";

export { ARUS_KAS_PERIODE, ARUS_KAS_PERIODE_LABEL } from "@/lib/arus-kas-types";
export type { ArusKasBaris, ArusKasKelompok, ArusKasPeriode, ArusKasSnapshot, SaldoSumber } from "@/lib/arus-kas-types";

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

export function resolveArusKasRange(
  periode: ArusKasPeriode,
  dari?: string,
  sampai?: string
): { start: Date; end: Date; label: string } {
  const now = new Date();
  const today = startOfDay(now);

  switch (periode) {
    case "hari-ini":
      return { start: today, end: endOfDay(now), label: fmtTgl(today) };
    case "minggu-ini": {
      const dow = (today.getDay() + 6) % 7; // Senin = 0
      const s = addDays(today, -dow);
      const e = addDays(s, 6);
      return { start: s, end: endOfDay(e), label: `${fmtTgl(s)} – ${fmtTgl(e)}` };
    }
    case "bulan-ini": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: s, end: endOfDay(last), label: `${fmtTgl(s)} – ${fmtTgl(last)}` };
    }
    case "tahun-ini": {
      const s = new Date(now.getFullYear(), 0, 1);
      const last = new Date(now.getFullYear(), 11, 31);
      return { start: s, end: endOfDay(last), label: `${fmtTgl(s)} – ${fmtTgl(last)}` };
    }
    case "bulan-lalu": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: s, end: endOfDay(last), label: `${fmtTgl(s)} – ${fmtTgl(last)}` };
    }
    case "tahun-lalu": {
      const s = new Date(now.getFullYear() - 1, 0, 1);
      const last = new Date(now.getFullYear() - 1, 11, 31);
      return { start: s, end: endOfDay(last), label: `${fmtTgl(s)} – ${fmtTgl(last)}` };
    }
    case "per-bulan-tahun-ini": {
      const s = new Date(now.getFullYear(), 0, 1);
      const last = new Date(now.getFullYear(), 11, 31);
      return { start: s, end: endOfDay(last), label: `Januari – Desember ${now.getFullYear()}` };
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

/** Rentang tiap bulan Januari s/d bulan berjalan (bulan depan belum terjadi). */
export function monthRangesOfCurrentYear(): { start: Date; end: Date; label: string }[] {
  const now = new Date();
  const out: { start: Date; end: Date; label: string }[] = [];
  for (let m = 0; m <= now.getMonth(); m++) {
    const s = new Date(now.getFullYear(), m, 1);
    const last = new Date(now.getFullYear(), m + 1, 0);
    out.push({
      start: s,
      end: endOfDay(last),
      label: last.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
    });
  }
  return out;
}

// ---------- Perhitungan snapshot ----------

const SUMBER = [
  { key: "KAS", kode: "1101", nama: "Kas" },
  { key: "BANK", kode: "1103", nama: "Bank" },
  { key: "TABUNGAN", kode: "1104", nama: "Tabungan" },
] as const;

type KasAgregat = { sumberDana: string; tipe: string; _sum: { jumlah: unknown } };
type KasTujuanAgregat = { sumberDanaTujuan: string | null; tipe: string; _sum: { jumlah: unknown } };

function saldoSumber(
  perSumber: KasAgregat[],
  perTujuan: KasTujuanAgregat[],
  sumber: string,
  namaAkun: (kode: string) => string
): SaldoSumber {
  const num = (v: unknown) => Math.round(Number(v ?? 0));
  const kode = SUMBER.find((s) => s.key === sumber)?.kode ?? sumber;
  const masuk = num(perSumber.find((r) => r.sumberDana === sumber && r.tipe === "PEMASUKAN")?._sum.jumlah);
  const keluar = num(perSumber.find((r) => r.sumberDana === sumber && r.tipe === "PENGELUARAN")?._sum.jumlah);
  const trfOut = num(perSumber.find((r) => r.sumberDana === sumber && r.tipe === "TRANSFER")?._sum.jumlah);
  const trfIn = num(perTujuan.find((r) => r.sumberDanaTujuan === sumber && r.tipe === "TRANSFER")?._sum.jumlah);
  return { sumber, kode, nama: namaAkun(kode), nilai: masuk - keluar - trfOut + trfIn };
}

function susunKelompok(
  judul: string,
  map: Map<string, { nama: string; masuk: number; keluar: number }>
): ArusKasKelompok {
  const baris = [...map.entries()]
    .sort()
    .filter(([, v]) => v.masuk !== 0 || v.keluar !== 0)
    .map(([kode, v]) => ({
      kode,
      nama: v.nama,
      nilai: Math.round(v.masuk - v.keluar),
    }));
  const masuk = Math.round([...map.values()].reduce((s, v) => s + v.masuk, 0));
  const keluar = Math.round([...map.values()].reduce((s, v) => s + v.keluar, 0));
  return { judul, baris, masuk, keluar, bersih: masuk - keluar };
}

function mapToJurnalPeriode(p: ArusKasPeriode): "hari-ini" | "minggu-ini" | "bulan-ini" | "tahun-ini" | "kemarin" | "minggu-lalu" | "bulan-lalu" | "tahun-lalu" | "custom" {
  return p === "per-bulan-tahun-ini" ? "custom" : (p as any);
}

export async function getArusKasSnapshot(
  start: Date,
  end: Date,
  periode: ArusKasPeriode,
  label: string
): Promise<ArusKasSnapshot> {
  const kasCodes = ["1101", "1103", "1104"];
  const kasSet = new Set(kasCodes);
  const num = (v: unknown) => Math.round(Number(v ?? 0));

  const akunDb = await prisma.akunCOA.findMany({ where: { isActive: true }, select: { kode: true, nama: true } });
  const namaAkun = (kode: string) => akunDb.find((a) => a.kode === kode)?.nama ?? kode;

  const openingEnd = new Date(start);
  openingEnd.setDate(openingEnd.getDate() - 1);
  openingEnd.setHours(23, 59, 59, 999);

  const [periodSnap, openingSnap, neracaSnap] = await Promise.all([
    getJurnalSnapshot(start, end, mapToJurnalPeriode(periode), label),
    getJurnalSnapshot(new Date("2000-01-01"), openingEnd, "custom", "opening"),
    getNeracaSnapshot(end, periode as any, label, start),
  ]);

  const saldoAwalMap = new Map<string, number>();
  for (const v of openingSnap.voucher) {
    for (const leg of v.legs) {
      if (!kasSet.has(leg.kode)) continue;
      const cur = saldoAwalMap.get(leg.kode) ?? 0;
      saldoAwalMap.set(leg.kode, cur + num(leg.debit) - num(leg.kredit));
    }
  }

  const netCashMap = new Map<string, number>();
  kasCodes.forEach((k) => netCashMap.set(k, 0));

  const op = new Map<string, { nama: string; masuk: number; keluar: number }>();
  const inv = new Map<string, { nama: string; masuk: number; keluar: number }>();
  const keu = new Map<string, { nama: string; masuk: number; keluar: number }>();
  const catatan: string[] = [];

  const addRow = (map: Map<string, { nama: string; masuk: number; keluar: number }>, key: string, nama: string, masuk: number, keluar: number) => {
    const cur = map.get(key) ?? { nama, masuk: 0, keluar: 0 };
    cur.masuk += masuk;
    cur.keluar += keluar;
    map.set(key, cur);
  };

  for (const v of periodSnap.voucher) {
    const legs = v.legs;
    const kasLegs = legs.filter((l) => kasSet.has(l.kode));
    if (kasLegs.length === 0) continue;
    if (kasLegs.length > 1) continue; // transfer antar kas
    const kasLeg = kasLegs[0];
    const lawanLegs = legs.filter((l) => !kasSet.has(l.kode));
    if (lawanLegs.length === 0) continue;
    let amount = 0;
    let cashIn = false;
    const d = num(kasLeg.debit);
    const c = num(kasLeg.kredit);
    if (d > 0) { cashIn = true; amount = d; }
    else if (c > 0) { cashIn = false; amount = c; }
    else continue;

    const net = netCashMap.get(kasLeg.kode) ?? 0;
    netCashMap.set(kasLeg.kode, net + (cashIn ? amount : -amount));

    const lawan = lawanLegs[0];
    const lawanKode = lawan.kode;
    const lawanNama = namaAkun(lawanKode);

    if (cashIn) {
      if (lawanKode === "1102") {
        addRow(op, "Penerimaan dari pelanggan (pelunasan piutang)", "Penerimaan dari pelanggan (pelunasan piutang)", amount, 0);
      } else if (/^4/.test(lawanKode)) {
        addRow(op, `Penerimaan dari ${lawanNama}`, `Penerimaan dari ${lawanNama}`, amount, 0);
      } else if (/^12/.test(lawanKode)) {
        addRow(inv, `Penjualan ${lawanNama}`, `Penjualan ${lawanNama}`, amount, 0);
      } else if (lawanKode === "3101" || lawanKode === "3102") {
        addRow(keu, "Setoran modal pemilik", "Setoran modal pemilik", amount, 0);
      } else {
        addRow(op, "Lainnya", "Lainnya", amount, 0);
      }
    } else {
      if (lawanKode === "2101") {
        addRow(op, "Pembayaran kepada pemasok", "Pembayaran kepada pemasok", 0, amount);
      } else if (/^5/.test(lawanKode)) {
        addRow(op, `Pembayaran ${lawanNama}`, `Pembayaran ${lawanNama}`, 0, amount);
      } else if (/^11(05|06|07)/.test(lawanKode)) {
        addRow(op, "Pembayaran pembelian persediaan", "Pembayaran pembelian persediaan", 0, amount);
      } else if (/^12/.test(lawanKode)) {
        addRow(inv, `Pembelian ${lawanNama}`, `Pembelian ${lawanNama}`, 0, amount);
      } else if (lawanKode === "3103") {
        addRow(keu, "Prive / penarikan modal", "Prive / penarikan modal", 0, amount);
      } else {
        addRow(op, "Lainnya", "Lainnya", 0, amount);
      }
    }
  }

  const operasional = susunKelompok("Arus Kas dari Aktivitas Operasional", op);
  const investasi = susunKelompok("Arus Kas dari Aktivitas Investasi", inv);
  const keuangan = susunKelompok("Arus Kas dari Aktivitas Keuangan", keu);

  if (operasional.baris.length === 0 && operasional.bersih === 0)
    catatan.push("Belum ada arus kas operasional pada periode ini.");
  if (investasi.baris.length === 0)
    catatan.push("Belum ada arus kas investasi pada periode ini (belum ada akuisisi/pelepasan aset tunai).");
  if (keuangan.baris.length === 0)
    catatan.push("Belum ada arus kas pendanaan pada periode ini (belum ada pelunasan/penerimaan utang atau setoran modal).");

  const totalMasuk = operasional.masuk + investasi.masuk + keuangan.masuk;
  const totalKeluar = operasional.keluar + investasi.keluar + keuangan.keluar;
  const kenaikan = totalMasuk - totalKeluar;
  const revaluasi = 0;

  const saldoAwalPerSumber: SaldoSumber[] = SUMBER.map((s) => {
    const nilai = saldoAwalMap.get(s.kode) ?? 0;
    return { sumber: s.key, kode: s.kode, nama: namaAkun(s.kode), nilai };
  });

  // saldo akhir per sumber dari Jurnal kumulatif termasuk transfer
  const saldoAkhirMap = new Map<string, number>();
  kasCodes.forEach((k) => {
    saldoAkhirMap.set(k, saldoAwalMap.get(k) ?? 0);
  });
  for (const v of periodSnap.voucher) {
    for (const leg of v.legs) {
      if (!kasSet.has(leg.kode)) continue;
      const cur = saldoAkhirMap.get(leg.kode) ?? 0;
      saldoAkhirMap.set(leg.kode, cur + num(leg.debit) - num(leg.kredit));
    }
  }
  const saldoAkhirPerSumber: SaldoSumber[] = SUMBER.map((s) => {
    const nilai = saldoAkhirMap.get(s.kode) ?? 0;
    return { sumber: s.key, kode: s.kode, nama: namaAkun(s.kode), nilai };
  });
  const saldoAwal = saldoAwalPerSumber.reduce((a, b) => a + b.nilai, 0);
  const saldoAkhir = saldoAkhirPerSumber.reduce((a, b) => a + b.nilai, 0);

  // Validasi vs Neraca Kas+Bank+Tabungan
  const kasNeraca = neracaSnap.aktivaLancar.baris
    .filter((b) => kasCodes.includes(b.kode))
    .reduce((s, b) => s + b.nilai, 0);
  if (saldoAkhir !== kasNeraca) {
    catatan.push(`Peringatan: Saldo Akhir Arus Kas Rp ${saldoAkhir.toLocaleString("id-ID")} ≠ Kas+Bank+Tabungan Neraca Rp ${kasNeraca.toLocaleString("id-ID")}.`);
  }

  catatan.push("Sumber data Jurnal; klasifikasi berdasarkan akun lawan; transfer antar kas dikecualikan.");

  return {
    periode,
    start: start.toISOString(),
    end: end.toISOString(),
    label,
    operasional,
    investasi,
    keuangan,
    totalMasuk,
    totalKeluar,
    kenaikan,
    revaluasi,
    saldoAwal,
    saldoAwalPerSumber,
    saldoAkhir,
    saldoAkhirPerSumber,
    catatan,
  };
}

/** Snapshot per bulan (Januari s/d bulan berjalan) untuk "per-bulan-tahun-ini". */
export async function getArusKasBulanan(): Promise<ArusKasSnapshot[]> {
  const out: ArusKasSnapshot[] = [];
  for (const m of monthRangesOfCurrentYear()) {
    out.push(await getArusKasSnapshot(m.start, m.end, "per-bulan-tahun-ini", m.label));
  }
  return out;
}
