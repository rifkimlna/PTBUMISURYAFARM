// Service Laporan Jurnal PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data (aktual database, tanpa sumber baru / tanpa dummy):
// - Setiap TransaksiKas = satu voucher jurnal dua kaki:
//   * PEMASUKAN: Dr Kas/Bank/Tabungan (sumberDana) / Cr kode akun.
//   * PENGELUARAN: Dr kode akun / Cr Kas/Bank/Tabungan (sumberDana).
//   * TRANSFER: Dr Kas/Bank/Tabungan tujuan / Cr Kas/Bank/Tabungan asal.
// - Nama akun dari tabel AkunCOA (fallback nama statis untuk kode kas).
// - Total debit = total kredit per voucher; Grand Total di akhir dokumen.

import { prisma } from "@/lib/prisma";
import type { JurnalLeg, JurnalPeriode, JurnalSnapshot, JurnalVoucher } from "@/lib/jurnal-types";

export { JURNAL_PERIODE, JURNAL_PERIODE_LABEL } from "@/lib/jurnal-types";
export type { JurnalLeg, JurnalPeriode, JurnalSnapshot, JurnalVoucher } from "@/lib/jurnal-types";

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

export function resolveJurnalRange(
  periode: JurnalPeriode,
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

// ---------- Penyusunan jurnal ----------

const SUMBER_KE_KODE: Record<string, string> = { KAS: "1101", BANK: "1103", TABUNGAN: "1104" };
const NAMA_KAS_FALLBACK: Record<string, string> = { "1101": "Kas", "1103": "Bank", "1104": "Tabungan" };
const BATAS_BARIS = 20000;

const num = (v: unknown) => Math.round(Number(v ?? 0));

export async function getJurnalSnapshot(
  start: Date,
  end: Date,
  periode: JurnalPeriode,
  label: string
): Promise<JurnalSnapshot> {
  const [akunDb, rows] = await Promise.all([
    prisma.akunCOA.findMany({ select: { kode: true, nama: true } }),
    prisma.transaksiKas.findMany({
      where: { tanggal: { gte: start, lte: end } },
      select: {
        id: true,
        tanggal: true,
        tipe: true,
        kategori: true,
        kodeAkun: true,
        sumberDana: true,
        sumberDanaTujuan: true,
        jumlah: true,
        keterangan: true,
        noTransaksi: true,
      },
      orderBy: [{ tanggal: "asc" }],
      take: BATAS_BARIS + 1,
    }),
  ]);

  if (rows.length > BATAS_BARIS) {
    throw new Error("Terlalu banyak transaksi pada periode ini — persempit rentang tanggal");
  }

  const namaAkun = new Map(akunDb.map((a) => [a.kode, a.nama]));
  const nama = (kode: string) =>
    namaAkun.get(kode) ?? NAMA_KAS_FALLBACK[kode] ?? `Akun ${kode}`;

  const voucher: JurnalVoucher[] = [];
  let grandTotalDebit = 0;
  let grandTotalKredit = 0;

  for (const r of rows) {
    const nilai = num(r.jumlah);
    if (nilai === 0) continue;
    const kasAsal = SUMBER_KE_KODE[r.sumberDana] ?? r.sumberDana;
    const legs: JurnalLeg[] = [];

    if (r.tipe === "TRANSFER") {
      const kasTujuan = r.sumberDanaTujuan ? (SUMBER_KE_KODE[r.sumberDanaTujuan] ?? r.sumberDanaTujuan) : "-";
      legs.push({ kode: kasTujuan, nama: nama(kasTujuan), debit: nilai, kredit: 0 });
      legs.push({ kode: kasAsal, nama: nama(kasAsal), debit: 0, kredit: nilai });
    } else if (r.tipe === "PEMASUKAN") {
      const kode = r.kodeAkun?.trim() || "";
      legs.push({ kode: kasAsal, nama: nama(kasAsal), debit: nilai, kredit: 0 });
      legs.push({
        kode: kode || "-",
        nama: kode ? nama(kode) : r.kategori || "Pemasukan",
        debit: 0,
        kredit: nilai,
      });
    } else {
      // PENGELUARAN
      const kode = r.kodeAkun?.trim() || "";
      legs.push({
        kode: kode || "-",
        nama: kode ? nama(kode) : r.kategori || "Pengeluaran",
        debit: nilai,
        kredit: 0,
      });
      legs.push({ kode: kasAsal, nama: nama(kasAsal), debit: 0, kredit: nilai });
    }

    const totalDebit = legs.reduce((s, l) => s + l.debit, 0);
    const totalKredit = legs.reduce((s, l) => s + l.kredit, 0);
    grandTotalDebit += totalDebit;
    grandTotalKredit += totalKredit;

    const uraian =
      r.tipe === "TRANSFER"
        ? `Transfer (${r.sumberDana} → ${r.sumberDanaTujuan ?? "-"})`
        : (r.keterangan?.trim() ? `${r.kategori} — ${r.keterangan.trim()}` : r.kategori);

    voucher.push({
      id: r.id,
      noTransaksi: r.noTransaksi,
      tanggal: r.tanggal.toISOString(),
      uraian,
      legs,
      totalDebit,
      totalKredit,
    });
  }

  const catatan: string[] = [
    "Setiap transaksi kas tercatat sebagai satu voucher dua kaki (debit = kredit).",
    "Kas/Bank/Tabungan memakai akun 1101/1103/1104 sesuai sumber dana; TRANSFER mencatat perpindahan antar kas.",
    "Dokumen pendukung (Biaya, Tagihan, Faktur, Penagihan) dikelola di modulnya masing-masing; realisasi kasnya tercatat di sini.",
  ];

  return {
    periode,
    start: start.toISOString(),
    end: end.toISOString(),
    label,
    voucher,
    grandTotalDebit,
    grandTotalKredit,
    catatan,
  };
}
