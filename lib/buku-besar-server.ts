// Service Laporan Buku Besar PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data: seluruh Jurnal (getJurnalSnapshot).
// - Setiap kaki jurnal debit/kredit dipakai apa adanya, tanpa pembalikan.
// - Saldo awal = akumulasi jurnal sebelum periode (sama seperti Neraca Saldo).
// - Akun pseudo HPP & SALDO_AWAL ditampilkan.
// - Akun tanpa COA ditampilkan di kelompok "Lainnya".

import { prisma } from "@/lib/prisma";
import { getJurnalSnapshot } from "@/lib/jurnal-server";
import type {
  BukuBesarAkun,
  BukuBesarBaris,
  BukuBesarPeriode,
  BukuBesarSnapshot,
} from "@/lib/buku-besar-types";

export { BUKU_BESAR_PERIODE, BUKU_BESAR_PERIODE_LABEL } from "@/lib/buku-besar-types";
export type { BukuBesarAkun, BukuBesarBaris, BukuBesarPeriode, BukuBesarSnapshot } from "@/lib/buku-besar-types";

// ---------- Rentang periode ----------
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
      const dow = (today.getDay() + 6) % 7;
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

// ---------- Helper ----------
const AWAL_EPOCH = new Date(2000, 0, 1);
const NAMA_FALLBACK: Record<string, string> = {
  "1101": "Kas",
  "1102": "Piutang",
  "1103": "Bank",
  "1104": "Tabungan",
};
const KELOMPOK_PSEUDO: Record<string, { nama: string; kelompok: string }> = {
  HPP: { nama: "Harga Pokok Penjualan", kelompok: "HARGA POKOK PENJUALAN" },
  SALDO_AWAL: { nama: "Saldo Awal Persediaan", kelompok: "Ekuitas" },
};

function isDebitNormal(kelompok: string) {
  return kelompok === "Aset" || kelompok === "Beban" || kelompok === "HARGA POKOK PENJUALAN";
}

function normalizeKelompok(kelompok: string) {
  if (kelompok === "Modal") return "Ekuitas";
  return kelompok;
}

const KELOMPOK_URUTAN = ["Aset", "Kewajiban", "Ekuitas", "Pendapatan", "HARGA POKOK PENJUALAN", "Beban", "Lainnya"];

function getMetaAkun(kode: string, meta: Map<string, { kode: string; nama: string; kelompok: string; golongan: string }>) {
  const m = meta.get(kode);
  if (m) return m;
  const pseudo = KELOMPOK_PSEUDO[kode];
  if (pseudo) {
    return { kode, nama: pseudo.nama, kelompok: pseudo.kelompok, golongan: "" };
  }
  return { kode, nama: NAMA_FALLBACK[kode] ?? `Akun ${kode}`, kelompok: "Lainnya", golongan: "" };
}

// ---------- Mapping periode ke JurnalPeriode ----------
function mapBukuBesarPeriodeToJurnal(p?: BukuBesarPeriode): "hari-ini" | "minggu-ini" | "bulan-ini" | "tahun-ini" | "kemarin" | "minggu-lalu" | "bulan-lalu" | "tahun-lalu" | "custom" {
  if (!p || p === "custom") return "custom";
  if (p === "triwulan-ini" || p === "kuartal-lalu" || p === "per-bulan-tahun-ini") return "custom";
  return p as any;
}

// ---------- Core ----------
export async function getBukuBesar(
  start: Date,
  end: Date,
  kodeAkun?: string,
  periode?: BukuBesarPeriode,
  label?: string
): Promise<BukuBesarSnapshot> {
  const [akunDb] = await Promise.all([
    prisma.akunCOA.findMany({
      select: { kode: true, nama: true, kelompok: true, golongan: true },
    }),
  ]);

  const meta = new Map(akunDb.map(a => [a.kode, a]));

  // Saldo awal
  const beforeEnd = new Date(start.getTime() - 1);
  let beforeVoucher: any[] = [];
  if (beforeEnd >= AWAL_EPOCH) {
    const beforeSnap = await getJurnalSnapshot(AWAL_EPOCH, beforeEnd, "custom", "before");
    beforeVoucher = beforeSnap.voucher;
  }

  const periodLabel = label ?? `${fmtTgl(start)} – ${fmtTgl(end)}`;
  const periodSnap = await getJurnalSnapshot(start, end, mapBukuBesarPeriodeToJurnal(periode), periodLabel);

  // Agregat saldo awal
  const saldoAwalMap = new Map<string, number>();
  const namaMap = new Map<string, string>();

  const agg = (vouchers: any[]) => {
    for (const v of vouchers) {
      for (const l of v.legs) {
        const kode = l.kode;
        const debit = Number(l.debit) || 0;
        const kredit = Number(l.kredit) || 0;
        const curNet = saldoAwalMap.get(kode) ?? 0;
        saldoAwalMap.set(kode, curNet + debit - kredit);
        if (!namaMap.has(kode)) namaMap.set(kode, l.nama);
      }
    }
  };
  agg(beforeVoucher);

  // Kumpulkan kode yang terlibat
  const kodeSet = new Set<string>([...saldoAwalMap.keys()]);
  for (const v of periodSnap.voucher) {
    for (const l of v.legs) kodeSet.add(l.kode);
  }

  // Inisialisasi akun
  type AkunData = {
    kode: string;
    nama: string;
    kelompok: string;
    golongan: string;
    saldoNormal: "debit" | "kredit";
    saldoAwal: number;
    saldo: number;
    baris: BukuBesarBaris[];
    totalDebit: number;
    totalKredit: number;
    _sign: number;
  };
  const akunMap = new Map<string, AkunData>();

  for (const kode of kodeSet) {
    const metaInfo = getMetaAkun(kode, meta);
    const nama = metaInfo.nama || namaMap.get(kode) || `Akun ${kode}`;
    const kelompok = metaInfo.kelompok;
    const golongan = metaInfo.golongan || "";
    const saldoNormal = isDebitNormal(kelompok) ? "debit" : "kredit";
    const sign = saldoNormal === "debit" ? 1 : -1;
    const netAwal = saldoAwalMap.get(kode) ?? 0;
    const saldoAwalNormal = netAwal * sign;
    akunMap.set(kode, {
      kode,
      nama,
      kelompok,
      golongan,
      saldoNormal,
      saldoAwal: saldoAwalNormal,
      saldo: saldoAwalNormal,
      baris: [],
      totalDebit: 0,
      totalKredit: 0,
      _sign: sign,
    });
  }

  // Proses periode kronologis
  for (const v of periodSnap.voucher) {
    const tglIso = v.tanggal;
    const noTransaksi = v.noTransaksi ?? null;
    // Transaksi dipakai sebagai uraian jurnal, keterangan kosong
    for (const l of v.legs) {
      const kode = l.kode;
      const data = akunMap.get(kode);
      if (!data) continue;
      const debit = Number(l.debit) || 0;
      const kredit = Number(l.kredit) || 0;
      if (debit === 0 && kredit === 0) continue;
      data.totalDebit += debit;
      data.totalKredit += kredit;
      const delta = (debit - kredit) * data._sign;
      data.saldo += delta;
      data.baris.push({
        tanggal: tglIso,
        transaksi: v.uraian,
        uraian: "",
        noTransaksi,
        keterangan: null,
        debit,
        kredit,
        saldo: data.saldo,
      });
    }
  }

  // Bangun hasil
  const akunList: BukuBesarAkun[] = [];
  let totalDebit = 0;
  let totalKredit = 0;

  const kodeList = Array.from(akunMap.keys()).sort((a, b) => a.localeCompare(b));

  for (const kode of kodeList) {
    const d = akunMap.get(kode)!;
    if (kodeAkun && kodeAkun !== "semua" && kode !== kodeAkun) continue;
    const hasMutasi = d.totalDebit !== 0 || d.totalKredit !== 0 || d.baris.length > 0;
    const hasSaldo = d.saldoAwal !== 0 || d.saldo !== d.saldoAwal;
    if (!kodeAkun || kodeAkun === "semua") {
      if (!hasSaldo && !hasMutasi) continue;
    }
    totalDebit += d.totalDebit;
    totalKredit += d.totalKredit;
    akunList.push({
      kode: d.kode,
      nama: d.nama,
      kelompok: normalizeKelompok(d.kelompok),
      golongan: d.golongan,
      saldoNormal: d.saldoNormal,
      saldoAwal: d.saldoAwal,
      baris: d.baris,
      totalDebit: d.totalDebit,
      totalKredit: d.totalKredit,
      saldoAkhir: d.saldo,
    });
  }

  akunList.sort((a, b) => {
    const ka = normalizeKelompok(a.kelompok);
    const kb = normalizeKelompok(b.kelompok);
    const ia = KELOMPOK_URUTAN.indexOf(ka);
    const ib = KELOMPOK_URUTAN.indexOf(kb);
    const orderA = ia === -1 ? 999 : ia;
    const orderB = ib === -1 ? 999 : ib;
    if (orderA !== orderB) return orderA - orderB;
    return a.kode.localeCompare(b.kode);
  });

  const catatan: string[] = [
    "Buku Besar bersumber dari seluruh Jurnal (transaksi kas, invoice penjualan, faktur pembelian, opname bernilai, HPP).",
    "Saldo awal = akumulasi jurnal sebelum periode; Pergerakan = jurnal dalam periode; Saldo akhir = saldo awal + pergerakan.",
    "Kolom Debit dan Kredit menampilkan sisi asli kaki jurnal tanpa pembalikan arah.",
  ];
  if (!kodeAkun || kodeAkun === "semua") {
    catatan.push("Hanya akun bersaldo awal atau bermutasi pada periode ini yang ditampilkan.");
  }

  return {
    periode: periode ?? "custom",
    start: start.toISOString(),
    end: end.toISOString(),
    label: periodLabel,
    akunFilter: kodeAkun && kodeAkun !== "semua" ? kodeAkun : "semua",
    akun: akunList,
    totalDebit,
    totalKredit,
    catatan,
  };
}

// ---------- Snapshots batch ----------
export async function getBukuBesarSnapshots(
  ranges: { start: Date; end: Date; label: string; periode: BukuBesarPeriode }[],
  akunFilter?: string
): Promise<BukuBesarSnapshot[]> {
  const snapshots: BukuBesarSnapshot[] = [];
  for (const r of ranges) {
    const snap = await getBukuBesar(r.start, r.end, akunFilter, r.periode, r.label);
    snapshots.push(snap);
  }
  return snapshots;
}

export async function getBukuBesarBulanan(akunFilter?: string): Promise<BukuBesarSnapshot[]> {
  const ranges = monthRangesOfCurrentYear().map((m) => ({ ...m, periode: "per-bulan-tahun-ini" as const }));
  return getBukuBesarSnapshots(ranges, akunFilter);
}
