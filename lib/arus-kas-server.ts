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
import { kodeAkunByNama } from "@/lib/coa";
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

export async function getArusKasSnapshot(
  start: Date,
  end: Date,
  periode: ArusKasPeriode,
  label: string
): Promise<ArusKasSnapshot> {
  const dalam = { gte: start, lte: end };
  const sebelum = { lt: start };
  const num = (v: unknown) => Math.round(Number(v ?? 0));

  const [arus, awalSumber, awalTujuan, akhirSumber, akhirTujuan, asetKasIds, akunDb] =
    await Promise.all([
      prisma.transaksiKas.findMany({
        where: { tanggal: dalam },
        select: { id: true, tipe: true, kodeAkun: true, kategori: true, jumlah: true, tagihanId: true },
      }),
      prisma.transaksiKas.groupBy({ by: ["sumberDana", "tipe"], where: { tanggal: sebelum }, _sum: { jumlah: true } }),
      prisma.transaksiKas.groupBy({
        by: ["sumberDanaTujuan", "tipe"],
        where: { tanggal: sebelum },
        _sum: { jumlah: true },
      }),
      prisma.transaksiKas.groupBy({ by: ["sumberDana", "tipe"], where: { tanggal: { lte: end } }, _sum: { jumlah: true } }),
      prisma.transaksiKas.groupBy({
        by: ["sumberDanaTujuan", "tipe"],
        where: { tanggal: { lte: end } },
        _sum: { jumlah: true },
      }),
      prisma.aset.findMany({ where: { transaksiKasId: { not: null } }, select: { transaksiKasId: true } }),
      prisma.akunCOA.findMany({ where: { isActive: true }, select: { kode: true, nama: true } }),
    ]);

  const namaAkun = (kode: string) =>
    akunDb.find((a) => a.kode === kode)?.nama ?? kode;
  // Reverse lookup nama -> kode dari DB (akun baru tidak ada di statis).
  const kodeByNama = new Map(akunDb.map((a) => [a.nama.trim().toLowerCase(), a.kode]));
  const kodeOf = (kodeTersimpan: string | null | undefined, tipe: "PEMASUKAN" | "PENGELUARAN", kategori: string) =>
    kodeTersimpan?.trim() ||
    kodeAkunByNama(tipe, kategori) ||
    kodeByNama.get(kategori.trim().toLowerCase()) ||
    "(tanpa kode)";
  const asetKas = new Set(asetKasIds.map((a) => a.transaksiKasId));
  const catatan: string[] = [];

  const op = new Map<string, { nama: string; masuk: number; keluar: number }>();
  const inv = new Map<string, { nama: string; masuk: number; keluar: number }>();
  const keu = new Map<string, { nama: string; masuk: number; keluar: number }>();
  const tambah = (
    map: Map<string, { nama: string; masuk: number; keluar: number }>,
    kode: string,
    nama: string,
    masuk: number,
    keluar: number
  ) => {
    const cur = map.get(kode) ?? { nama, masuk: 0, keluar: 0 };
    cur.masuk += masuk;
    cur.keluar += keluar;
    map.set(kode, cur);
  };

  for (const t of arus) {
    if (t.tipe === "TRANSFER") continue; // perpindahan internal
    const nilai = num(t.jumlah);
    if (nilai === 0) continue;
    if (t.tipe === "PEMASUKAN") {
      const kode = kodeOf(t.kodeAkun, "PEMASUKAN", t.kategori);
      if (/^31/.test(kode)) tambah(keu, kode, namaAkun(kode), nilai, 0); // setoran modal
      else if (/^12/.test(kode)) tambah(inv, kode, namaAkun(kode), nilai, 0); // hasil penjualan aset
      else tambah(op, kode, kode.startsWith("(") ? t.kategori : namaAkun(kode), nilai, 0);
    } else {
      const kode = kodeOf(t.kodeAkun, "PENGELUARAN", t.kategori);
      if (/^31/.test(kode)) {
        tambah(keu, kode, namaAkun(kode), 0, nilai); // penarikan modal / prive
      } else if (asetKas.has(t.id) || /^12/.test(kode)) {
        const kunci = /^12/.test(kode) ? kode : "ASET";
        tambah(inv, kunci, /^12/.test(kode) ? namaAkun(kode) : t.kategori, 0, nilai);
      } else if (t.tagihanId || kode === "5501") {
        tambah(keu, "5501", namaAkun("5501"), 0, nilai); // pelunasan utang
      } else {
        tambah(op, kode, kode.startsWith("(") ? t.kategori : namaAkun(kode), 0, nilai);
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
  catatan.push("Total Revaluasi Bank Rp 0 karena sistem tidak mencatat selisih kurs/valuta asing.");

  const saldoAwalPerSumber = SUMBER.map((s) => saldoSumber(awalSumber, awalTujuan, s.key, namaAkun));
  const saldoAkhirPerSumber = SUMBER.map((s) => saldoSumber(akhirSumber, akhirTujuan, s.key, namaAkun));
  const saldoAwal = saldoAwalPerSumber.reduce((a, b) => a + b.nilai, 0);
  const saldoAkhir = saldoAwalPerSumber.reduce((a, b) => a + b.nilai, 0) + kenaikan;

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
