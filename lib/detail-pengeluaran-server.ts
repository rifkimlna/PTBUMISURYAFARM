// Service Laporan Detail Pengeluaran PT Bumi Surya Farm
// (KHUSUS modul Laporan Detail Pengeluaran).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Data aktual database, tanpa dummy (periode = rentang, bukan kumulatif).
// Sumber pengeluaran (dihitung SEKALI per kejadian akuntansi, memakai aturan
// yang sama dengan Laba Rugi agar angka konsisten & tidak ganda):
//   - Biaya.tanggal dalam periode (tunai maupun hutang);
//   - TransaksiKas PENGELUARAN tanpa tagihan, KECUALI:
//       * kaki akuisisi aset (Aset.transaksiKasId),
//       * kaki biaya tunai (Biaya.transaksiKasId) — sudah diwakili baris Biaya,
//       * mutasi modal 31xx (mis. prive),
//       * pembelian persediaan (golongan "Persediaan" / kode 1105-1107),
//       * akuisisi aset tetap (kode 12xx).
// Baris dikelompokkan per kategori akun biaya (kode COA); akun tanpa mapping
// disajikan sebagai "(tanpa kode)".

import { prisma } from "@/lib/prisma";
import { kodeAkunByNama } from "@/lib/coa";
import type {
  DetailPengeluaranBaris,
  DetailPengeluaranKategori,
  DetailPengeluaranPeriode,
  DetailPengeluaranSnapshot,
} from "@/lib/detail-pengeluaran-types";

export { DETAIL_PENGELUARAN_PERIODE, DETAIL_PENGELUARAN_PERIODE_LABEL } from "@/lib/detail-pengeluaran-types";
export type {
  DetailPengeluaranBaris,
  DetailPengeluaranKategori,
  DetailPengeluaranPeriode,
  DetailPengeluaranSnapshot,
} from "@/lib/detail-pengeluaran-types";

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

export function resolveDetailPengeluaranRange(
  periode: DetailPengeluaranPeriode,
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

export async function getDetailPengeluaranSnapshot(
  start: Date,
  end: Date,
  periode: DetailPengeluaranPeriode,
  label: string
): Promise<DetailPengeluaranSnapshot> {
  const dalam = { gte: start, lte: end };
  const num = (v: unknown) => Math.round(Number(v ?? 0));

  const [biayaList, kasKeluar, asetKasIds, biayaKasIds, akunDb, fakturItems] = await Promise.all([
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
    prisma.fakturPembelianItem.findMany({
      where: {
        faktur: { tanggal: dalam },
        kodeAkun: { startsWith: "5" },
      },
      select: { jumlah: true },
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

  const catatan: string[] = [];

  type Akum = { kode: string; nama: string; baris: DetailPengeluaranBaris[]; subtotal: number };
  const kategoriMap = new Map<string, Akum>();
  const taruh = (kode: string, nama: string, baris: DetailPengeluaranBaris) => {
    if (baris.jumlah === 0) return;
    const key = kode || "(tanpa kode)";
    const cur = kategoriMap.get(key) ?? { kode: key, nama: nama || "Belum Teridentifikasi", baris: [], subtotal: 0 };
    cur.baris.push(baris);
    cur.subtotal += baris.jumlah;
    kategoriMap.set(key, cur);
  };

  // --- Biaya (model Biaya) ---
  for (const b of biayaList) {
    const kode = b.kodeAkun?.trim() || "";
    taruh(kode, kode ? namaAkun(kode) : b.kategori, {
      id: `biaya-${b.id}`,
      tanggal: b.tanggal.toISOString(),
      transaksi: b.penerima || "Biaya",
      nomor: b.noBiaya || null,
      keterangan: b.memo || null,
      jumlah: num(b.jumlah),
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
    taruh(kode, kode ? namaAkun(kode) : k.kategori, {
      id: `kas-${k.id}`,
      tanggal: k.tanggal.toISOString(),
      transaksi: k.pihak || k.kategori || "Pengeluaran Kas",
      nomor: k.noTransaksi || null,
      keterangan: k.keterangan || k.deskripsi || null,
      jumlah: num(k.jumlah),
      sumber: "Kas",
    });
  }

  // Urutkan kategori per kode; baris per tanggal naik lalu nomor.
  const kategori: DetailPengeluaranKategori[] = [...kategoriMap.values()]
    .sort((a, b) => a.kode.localeCompare(b.kode))
    .map((k) => ({
      kode: k.kode,
      nama: k.nama,
      subtotal: Math.round(k.subtotal),
      baris: k.baris.sort((a, b) => {
        const t = new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
        if (t !== 0) return t;
        return (a.nomor ?? "").localeCompare(b.nomor ?? "");
      }),
    }));

  const grandTotal = kategori.reduce((s, k) => s + k.subtotal, 0);
  const jumlahTransaksi = kategori.reduce((s, k) => s + k.baris.length, 0);

  const bebanFaktur = fakturItems.reduce((s, i) => s + num(i.jumlah), 0);
  const totalBebanLabaRugi = grandTotal + bebanFaktur;

  if (kategoriMap.has("(tanpa kode)")) {
    catatan.push("Ada pengeluaran tanpa mapping COA — disajikan sebagai kelompok “(tanpa kode)”.");
  }
  catatan.push("Laporan ini menampilkan rincian pengeluaran biaya/kas yang tercatat. Bukan seluruh beban akuntansi.");
  catatan.push("Pelunasan hutang usaha (kas bertagihan), pembelian persediaan, dan akuisisi aset tetap tidak termasuk pengeluaran di laporan ini.");
  catatan.push("Satu pengeluaran dihitung tepat satu kali (tanpa transaksi ganda).");
  catatan.push(`Rekonsiliasi ke Laba Rugi: Total biaya dalam laporan Rp ${grandTotal.toLocaleString("id-ID")}, beban faktur pembelian belum tercakup Rp ${bebanFaktur.toLocaleString("id-ID")}, total beban sesuai Laba Rugi Rp ${totalBebanLabaRugi.toLocaleString("id-ID")}.`);
  catatan.push("Beban faktur pembelian diakui akrual pada tanggal faktur dan tercermin di Laba Rugi, namun tidak termasuk dalam rincian pengeluaran kas/biaya ini.");

  return {
    periode,
    start: start.toISOString(),
    end: end.toISOString(),
    label,
    kategori,
    grandTotal,
    jumlahTransaksi,
    catatan: [...new Set(catatan)],
  };
}
