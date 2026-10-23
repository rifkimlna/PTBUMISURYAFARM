// Service Laporan Daftar Pengeluaran PT Bumi Surya Farm
// (KHUSUS modul Laporan Daftar Pengeluaran).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Data aktual database, tanpa dummy (periode = rentang, bukan kumulatif).
// Sumber pengeluaran (dihitung SEKALI per kejadian akuntansi, memakai aturan
// yang sama dengan Laba Rugi & Detail Pengeluaran agar angka konsisten):
//   - Biaya.tanggal dalam periode (tunai maupun hutang);
//   - TransaksiKas PENGELUARAN tanpa tagihan, KECUALI:
//       * kaki akuisisi aset (Aset.transaksiKasId),
//       * kaki biaya tunai (Biaya.transaksiKasId) — sudah diwakili baris Biaya,
//       * mutasi modal 31xx (mis. prive),
//       * pembelian persediaan (golongan "Persediaan" / kode 1105-1107),
//       * akuisisi aset tetap (kode 12xx).
// Transfer antar kas/bank tidak ikut (bukan beban), dan pelunasan hutang usaha
// (kas bertagihan) dikecualikan agar tidak terhitung sebagai biaya.
// Baris disajikan sebagai daftar datar, urut per tanggal lalu nomor.

import { prisma } from "@/lib/prisma";
import { kodeAkunByNama } from "@/lib/coa";
import type {
  DaftarPengeluaranBaris,
  DaftarPengeluaranPeriode,
  DaftarPengeluaranSnapshot,
} from "@/lib/daftar-pengeluaran-types";

export { DAFTAR_PENGELUARAN_PERIODE, DAFTAR_PENGELUARAN_PERIODE_LABEL } from "@/lib/daftar-pengeluaran-types";
export type {
  DaftarPengeluaranBaris,
  DaftarPengeluaranPeriode,
  DaftarPengeluaranSnapshot,
} from "@/lib/daftar-pengeluaran-types";

// ---------- Rentang periode (kalender lokal, pola yang sama dengan Jurnal) ----------

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

export function resolveDaftarPengeluaranRange(
  periode: DaftarPengeluaranPeriode,
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
    case "kemarin": {
      const y = addDays(today, -1);
      return { start: y, end: endOfDay(y), label: fmtTgl(y) };
    }
    case "minggu-lalu": {
      const dow = (today.getDay() + 6) % 7;
      const s = addDays(today, -dow - 7);
      const e = addDays(s, 6);
      return { start: s, end: endOfDay(e), label: `${fmtTgl(s)} – ${fmtTgl(e)}` };
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
    case "custom": {
      if (!dari || !sampai) throw new Error("Periode custom membutuhkan tanggal mulai & tanggal akhir");
      const s = startOfDay(new Date(dari));
      const e = new Date(sampai);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()))
        throw new Error("Tanggal custom tidak valid");
      if (endOfDay(e) < s) throw new Error("Tanggal akhir tidak boleh lebih awal dari tanggal mulai");
      return { start: s, end: endOfDay(e), label: `${fmtTgl(s)} – ${fmtTgl(e)}` };
    }
  }
}

// ---------- Perhitungan snapshot ----------

export async function getDaftarPengeluaranSnapshot(
  start: Date,
  end: Date,
  periode: DaftarPengeluaranPeriode,
  label: string
): Promise<DaftarPengeluaranSnapshot> {
  const dalam = { gte: start, lte: end };
  const num = (v: unknown) => Math.round(Number(v ?? 0));

  const [biayaList, kasKeluar, asetKasIds, biayaKasIds, akunDb] = await Promise.all([
    prisma.biaya.findMany({
      where: { tanggal: dalam },
      select: {
        id: true,
        noBiaya: true,
        tanggal: true,
        kategori: true,
        kodeAkun: true,
        penerima: true,
        jumlah: true,
        memo: true,
      },
    }),
    prisma.transaksiKas.findMany({
      where: { tipe: "PENGELUARAN", tanggal: dalam, tagihanId: null },
      select: {
        id: true,
        kodeAkun: true,
        kategori: true,
        jumlah: true,
        tanggal: true,
        noTransaksi: true,
        pihak: true,
        keterangan: true,
        deskripsi: true,
      },
    }),
    prisma.aset.findMany({ where: { transaksiKasId: { not: null } }, select: { transaksiKasId: true } }),
    prisma.biaya.findMany({ where: { transaksiKasId: { not: null } }, select: { transaksiKasId: true } }),
    prisma.akunCOA.findMany({
      where: { isActive: true },
      select: { kode: true, nama: true, golongan: true },
    }),
  ]);

  const coa = new Map(akunDb.map((a) => [a.kode, a]));
  const kodeByNama = new Map(akunDb.map((a) => [a.nama.trim().toLowerCase(), a.kode]));
  const kodeOf = (kodeTersimpan: string | null | undefined, kategori: string) =>
    kodeTersimpan?.trim() || kodeAkunByNama("PENGELUARAN", kategori) || kodeByNama.get(kategori.trim().toLowerCase()) || "";
  const namaAkun = (kode: string) => coa.get(kode)?.nama ?? `Akun ${kode}`;
  const golOf = (kode: string) => coa.get(kode)?.golongan ?? "";

  const asetKas = new Set(asetKasIds.map((a) => a.transaksiKasId));
  const biayaKas = new Set(biayaKasIds.map((b) => b.transaksiKasId));

  const baris: DaftarPengeluaranBaris[] = [];
  let tanpaKode = false;

  // --- Biaya (model Biaya) ---
  for (const b of biayaList) {
    const jumlah = num(b.jumlah);
    if (jumlah === 0) continue;
    const kode = b.kodeAkun?.trim() || "";
    if (!kode) tanpaKode = true;
    baris.push({
      id: `biaya-${b.id}`,
      tanggal: b.tanggal.toISOString(),
      nomor: b.noBiaya || null,
      kategori: kode ? namaAkun(kode) : b.kategori,
      deskripsi: b.memo || null,
      supplier: b.penerima || null,
      jumlah,
      sumber: "Biaya",
    });
  }

  // --- TransaksiKas PENGELUARAN (tanpa tagihan, bukan kaki aset/biaya) ---
  for (const k of kasKeluar) {
    if (asetKas.has(k.id) || biayaKas.has(k.id)) continue;
    const kode = kodeOf(k.kodeAkun, k.kategori);
    if (kode.startsWith("31")) continue; // mutasi modal (prive), bukan beban
    if (golOf(kode) === "Persediaan") continue; // pembelian persediaan
    if (/^12/.test(kode)) continue; // akuisisi aset tetap
    const jumlah = num(k.jumlah);
    if (jumlah === 0) continue;
    if (!kode) tanpaKode = true;
    baris.push({
      id: `kas-${k.id}`,
      tanggal: k.tanggal.toISOString(),
      nomor: k.noTransaksi || null,
      kategori: kode ? namaAkun(kode) : k.kategori,
      deskripsi: k.keterangan || k.deskripsi || null,
      supplier: k.pihak || null,
      jumlah,
      sumber: "Kas",
    });
  }

  // Urutkan tanggal naik lalu nomor.
  baris.sort((a, b) => {
    const t = new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
    if (t !== 0) return t;
    return (a.nomor ?? "").localeCompare(b.nomor ?? "");
  });

  const grandTotal = baris.reduce((s, b) => s + b.jumlah, 0);

  const catatan: string[] = [];
  if (tanpaKode) {
    catatan.push("Ada pengeluaran tanpa mapping COA — kategori disajikan sesuai data tersimpan.");
  }
  catatan.push("Transfer antar kas/bank, pelunasan hutang usaha, pembelian persediaan, dan akuisisi aset tetap tidak termasuk pengeluaran di laporan ini.");
  catatan.push("Satu pengeluaran dihitung tepat satu kali (tanpa transaksi ganda).");

  return {
    periode,
    start: start.toISOString(),
    end: end.toISOString(),
    label,
    baris,
    grandTotal,
    jumlahTransaksi: baris.length,
    catatan: [...new Set(catatan)],
  };
}
