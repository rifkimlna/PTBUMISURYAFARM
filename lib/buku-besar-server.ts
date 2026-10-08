// Service Laporan Buku Besar PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data (aktual database, tanpa sumber baru — konsisten dengan rute
// detail COA /api/keuangan/coa/[kode]/transaksi):
// - TransaksiKas berkode akun (kodeAkun): PEMASUKAN = penambah, PENGELUARAN
//   = pengurang pada akun tersebut.
// - Kas/Bank/Tabungan (1101/1103/1104): transfer-aware per sumberDana /
//   sumberDanaTujuan (TRANSFER keluar = pengurang asal, TRANSFER masuk =
//   penambah tujuan), konsisten dengan Neraca & Arus Kas.
// - Saldo debit-normal (Aset/Beban): Debit menambah, Kredit mengurangi.
//   Saldo kredit-normal (Kewajiban/Modal/Pendapatan): sebaliknya.
// - Saldo awal = efek kumulatif sebelum periode; hanya akun bersaldo atau
//   bermutasi yang ditampilkan (kecuali filter akun spesifik).

import { prisma } from "@/lib/prisma";
import type {
  BukuBesarAkun,
  BukuBesarBaris,
  BukuBesarPeriode,
  BukuBesarSnapshot,
} from "@/lib/buku-besar-types";

export { BUKU_BESAR_PERIODE, BUKU_BESAR_PERIODE_LABEL } from "@/lib/buku-besar-types";
export type { BukuBesarAkun, BukuBesarBaris, BukuBesarPeriode, BukuBesarSnapshot } from "@/lib/buku-besar-types";

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

export function resolveBukuBesarRange(
  periode: BukuBesarPeriode,
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
    case "triwulan-ini": {
      const q = Math.floor(now.getMonth() / 3);
      const s = new Date(now.getFullYear(), q * 3, 1);
      const last = new Date(s.getFullYear(), s.getMonth() + 3, 0);
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
    case "kuartal-lalu": {
      const q = Math.floor(now.getMonth() / 3) - 1;
      const s = new Date(now.getFullYear(), q * 3, 1);
      const last = new Date(s.getFullYear(), s.getMonth() + 3, 0);
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

/** Rentang tiap bulan Januari s/d bulan berjalan (untuk "per-bulan-tahun-ini"). */
export function monthRangesOfCurrentYear(): { start: Date; end: Date; label: string }[] {
  const now = new Date();
  const out: { start: Date; end: Date; label: string }[] = [];
  for (let m = 0; m <= now.getMonth(); m++) {
    const s = new Date(now.getFullYear(), m, 1);
    const last = new Date(now.getFullYear(), m + 1, 0);
    out.push({
      start: s,
      end: endOfDay(m === now.getMonth() ? now : last),
      label: last.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
    });
  }
  return out;
}

// ---------- Penyusunan buku besar ----------

const KODE_KAS = new Set(["1101", "1103", "1104"]);
const SUMBER_KE_KODE: Record<string, string> = { KAS: "1101", BANK: "1103", TABUNGAN: "1104" };
const KELOMPOK_URUTAN = ["Aset", "Kewajiban", "Modal", "Pendapatan", "Beban"];
const BATAS_BARIS = 20000;

const NAMA_AKUN_FALLBACK: Record<string, string> = {
  "1101": "Kas",
  "1102": "Piutang",
  "1103": "Bank",
  "1104": "Tabungan",
};

type KasRow = {
  tanggal: Date;
  tipe: string;
  kodeAkun: string | null;
  kategori: string;
  sumberDana: string;
  sumberDanaTujuan: string | null;
  jumlah: unknown;
  keterangan: string | null;
  noTransaksi: string | null;
  pihak: string | null;
};

const num = (v: unknown) => Math.round(Number(v ?? 0));

function isDebitNormal(kelompok: string) {
  return kelompok === "Aset" || kelompok === "Beban";
}

/** Efek satu baris kas ke satu akun: { tambah, kurang } sebelum konversi debit/kredit. */
function efekKeAkun(
  r: KasRow,
  kode: string,
  awal: { tambah: number; kurang: number }
): { tambah: number; kurang: number } {
  const nilai = num(r.jumlah);
  if (nilai === 0) return awal;
  let { tambah, kurang } = awal;
  // Kaki kode akun (selain kas — kas dilacak via kaki sumber dana).
  if (r.kodeAkun === kode && !KODE_KAS.has(kode) && r.tipe !== "TRANSFER") {
    if (r.tipe === "PEMASUKAN") tambah += nilai;
    else if (r.tipe === "PENGELUARAN") kurang += nilai;
  }
  // Kaki sumber dana untuk Kas/Bank/Tabungan (transfer-aware).
  const kodeSumber = SUMBER_KE_KODE[r.sumberDana];
  if (kodeSumber === kode) {
    if (r.tipe === "PEMASUKAN") tambah += nilai;
    else kurang += nilai; // PENGELUARAN maupun TRANSFER keluar
  }
  if (r.tipe === "TRANSFER" && r.sumberDanaTujuan) {
    if (SUMBER_KE_KODE[r.sumberDanaTujuan] === kode) tambah += nilai;
  }
  return { tambah, kurang };
}

function keDebitKredit(
  tambah: number,
  kurang: number,
  debitNormal: boolean
): { debit: number; kredit: number } {
  return debitNormal ? { debit: tambah, kredit: kurang } : { debit: kurang, kredit: tambah };
}

function uraian(r: KasRow) {
  const kat = r.kategori || (r.tipe === "TRANSFER" ? "Transfer" : r.tipe);
  if (r.tipe === "TRANSFER") {
    const tujuan = r.sumberDanaTujuan ?? "-";
    return `${kat} (${r.sumberDana} → ${tujuan})`;
  }
  return r.keterangan?.trim() ? `${kat} — ${r.keterangan.trim()}` : kat;
}

/** Kolom Transaksi: kategori asli / info transfer (data asli, tanpa dummy). */
function transaksiLabel(r: KasRow) {
  const kat = r.kategori?.trim() || r.tipe;
  if (r.tipe === "TRANSFER") {
    const tujuan = r.sumberDanaTujuan ?? "-";
    return kat && kat !== "TRANSFER" ? `${kat} (${r.sumberDana} → ${tujuan})` : `Transfer (${r.sumberDana} → ${tujuan})`;
  }
  return kat;
}

/** Kolom Keterangan: keterangan asli + pihak bila ada (data asli, tanpa dummy). */
function keteranganAsli(r: KasRow) {
  const ket = r.keterangan?.trim() ?? "";
  const pihak = r.pihak?.trim() ?? "";
  if (ket && pihak) return `${ket} — ${pihak}`;
  return ket || pihak || null;
}

export async function getBukuBesarSnapshots(
  ranges: { start: Date; end: Date; label: string; periode: BukuBesarPeriode }[],
  akunFilter?: string
): Promise<BukuBesarSnapshot[]> {
  const globalStart = ranges.reduce((a, r) => (r.start < a ? r.start : a), ranges[0].start);
  const globalEnd = ranges.reduce((a, r) => (r.end > a ? r.end : a), ranges[0].end);

  const [akunDb, awalKode, awalSumber, awalTujuan, rows] = await Promise.all([
    prisma.akunCOA.findMany({
      select: { kode: true, nama: true, kelompok: true, golongan: true },
    }),
    prisma.transaksiKas.groupBy({
      by: ["kodeAkun", "tipe"],
      where: { kodeAkun: { not: null }, tipe: { in: ["PEMASUKAN", "PENGELUARAN"] }, tanggal: { lt: globalStart } },
      _sum: { jumlah: true },
    }),
    prisma.transaksiKas.groupBy({
      by: ["sumberDana", "tipe"],
      where: { tanggal: { lt: globalStart } },
      _sum: { jumlah: true },
    }),
    prisma.transaksiKas.groupBy({
      by: ["sumberDanaTujuan", "tipe"],
      where: { tipe: "TRANSFER", tanggal: { lt: globalStart } },
      _sum: { jumlah: true },
    }),
    prisma.transaksiKas.findMany({
      where: { tanggal: { gte: globalStart, lte: globalEnd } },
      select: {
        tanggal: true,
        tipe: true,
        kodeAkun: true,
        kategori: true,
        sumberDana: true,
        sumberDanaTujuan: true,
        jumlah: true,
        keterangan: true,
        noTransaksi: true,
        pihak: true,
      },
      orderBy: [{ tanggal: "asc" }],
      take: BATAS_BARIS + 1,
    }),
  ]);

  if (rows.length > BATAS_BARIS) {
    throw new Error("Terlalu banyak mutasi pada periode ini — persempit rentang tanggal");
  }

  const meta = new Map(akunDb.map((a) => [a.kode, a]));
  // Kode kas selalu tersedia walau belum ada di DB.
  for (const [kode, nama] of Object.entries(NAMA_AKUN_FALLBACK)) {
    if (!meta.has(kode)) {
      meta.set(kode, { kode, nama, kelompok: "Aset", golongan: "Kas & Setara" });
    }
  }

  const kodeList = [...meta.keys()].sort((a, b) => {
    const ka = meta.get(a)!;
    const kb = meta.get(b)!;
    const ia = KELOMPOK_URUTAN.indexOf(ka.kelompok);
    const ib = KELOMPOK_URUTAN.indexOf(kb.kelompok);
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b);
  });

  if (akunFilter && akunFilter !== "semua" && !meta.has(akunFilter)) {
    throw new Error(`Akun ${akunFilter} tidak terdaftar di Daftar Akun`);
  }

  const awalTambahKurang = (kode: string): { tambah: number; kurang: number } => {
    let tambah = 0;
    let kurang = 0;
    if (!KODE_KAS.has(kode)) {
      for (const g of awalKode) {
        if (g.kodeAkun !== kode) continue;
        if (g.tipe === "PEMASUKAN") tambah += num(g._sum.jumlah);
        else if (g.tipe === "PENGELUARAN") kurang += num(g._sum.jumlah);
      }
    }
    const sumber = Object.entries(SUMBER_KE_KODE).find(([, k]) => k === kode)?.[0];
    if (sumber) {
      for (const g of awalSumber) {
        if (g.sumberDana !== sumber) continue;
        if (g.tipe === "PEMASUKAN") tambah += num(g._sum.jumlah);
        else kurang += num(g._sum.jumlah); // PENGELUARAN + TRANSFER keluar
      }
      for (const g of awalTujuan) {
        if (g.sumberDanaTujuan !== sumber) continue;
        tambah += num(g._sum.jumlah); // TRANSFER masuk
      }
    }
    return { tambah, kurang };
  };

  // Saldo awal global (sebelum rentang pertama) per akun.
  const saldoAwalGlobal = new Map<string, number>();
  for (const kode of kodeList) {
    const { tambah, kurang } = awalTambahKurang(kode);
    saldoAwalGlobal.set(kode, tambah - kurang);
  }

  const snapshots: BukuBesarSnapshot[] = [];
  // Saldo berjalan antar rentang (untuk mode per-bulan).
  const berjalan = new Map<string, number>(saldoAwalGlobal);

  for (const r of ranges) {
    const akun: BukuBesarAkun[] = [];
    let totalDebit = 0;
    let totalKredit = 0;

    for (const kode of kodeList) {
      if (akunFilter && akunFilter !== "semua" && kode !== akunFilter) continue;
      const m = meta.get(kode)!;
      const debitNormal = isDebitNormal(m.kelompok);
      const saldoAwal = berjalan.get(kode) ?? 0;
      let saldo = saldoAwal;
      const baris: BukuBesarBaris[] = [];
      let td = 0;
      let tk = 0;

      for (const row of rows as KasRow[]) {
        if (row.tanggal < r.start || row.tanggal > r.end) continue;
        const { tambah, kurang } = efekKeAkun(row, kode, { tambah: 0, kurang: 0 });
        if (tambah === 0 && kurang === 0) continue;
        const { debit, kredit } = keDebitKredit(tambah, kurang, debitNormal);
        saldo += tambah - kurang;
        td += debit;
        tk += kredit;
        baris.push({
          tanggal: row.tanggal.toISOString(),
          transaksi: transaksiLabel(row),
          uraian: uraian(row),
          noTransaksi: row.noTransaksi,
          keterangan: keteranganAsli(row),
          debit,
          kredit,
          saldo,
        });
      }

      const saldoAkhir = saldo;
      berjalan.set(kode, saldoAkhir);
      if (akunFilter && akunFilter !== "semua") {
        // Filter spesifik selalu ditampilkan walau kosong.
      } else if (saldoAwal === 0 && baris.length === 0) {
        continue;
      }
      totalDebit += td;
      totalKredit += tk;
      akun.push({
        kode,
        nama: m.nama,
        kelompok: m.kelompok,
        golongan: m.golongan,
        saldoNormal: debitNormal ? "debit" : "kredit",
        saldoAwal,
        baris,
        totalDebit: td,
        totalKredit: tk,
        saldoAkhir,
      });
    }

    const catatan: string[] = [];
    catatan.push(
      "Mutasi berasal dari TransaksiKas: PEMASUKAN = penambah, PENGELUARAN = pengurang; Kas/Bank/Tabungan (1101/1103/1104) memperhitungkan TRANSFER masuk/keluar."
    );
    if (!akunFilter || akunFilter === "semua") {
      catatan.push("Hanya akun bersaldo awal atau bermutasi pada periode ini yang ditampilkan.");
    }
    catatan.push(
      "Piutang (1102) & Utang Usaha (2101) mencerminkan mutasi kas bertagihan; pembentukan tagihan tercatat di modul Tagihan/Penjualan/Pembelian."
    );

    snapshots.push({
      periode: r.periode,
      start: r.start.toISOString(),
      end: r.end.toISOString(),
      label: r.label,
      akunFilter: akunFilter && akunFilter !== "semua" ? akunFilter : "semua",
      akun,
      totalDebit,
      totalKredit,
      catatan,
    });
  }

  return snapshots;
}

/** Snapshot bulanan (Januari s/d bulan berjalan) untuk "per-bulan-tahun-ini". */
export async function getBukuBesarBulanan(akunFilter?: string): Promise<BukuBesarSnapshot[]> {
  const ranges = monthRangesOfCurrentYear().map((m) => ({ ...m, periode: "per-bulan-tahun-ini" as const }));
  return getBukuBesarSnapshots(ranges, akunFilter);
}
