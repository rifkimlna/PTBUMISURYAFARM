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
import { getCOAMappingByKategori } from "@/lib/persediaan-coa-mapping";
import { DOKUMEN_PENJUALAN_STATUS_SAH } from "@/lib/piutang-rules";

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

function isTerimaPiutang(t: { tag?: string | null; kategori?: string | null }) {
  if (t.tag === "TERIMA_PIUTANG") return true;
  return t.kategori?.trim().toLowerCase() === "penerimaan piutang usaha";
}

export async function getJurnalSnapshot(
  start: Date,
  end: Date,
  periode: JurnalPeriode,
  label: string
): Promise<JurnalSnapshot> {
  const [akunDb, rows, dokumenPenjualan, fakturPembelian, riwayatOpname, riwayatMasukAll, riwayatKeluar] = await Promise.all([
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
        tag: true,
      },
      orderBy: [{ tanggal: "asc" }],
      take: BATAS_BARIS + 1,
    }),
    prisma.dokumenPenjualan.findMany({
      where: {
        tipe: "PENAGIHAN",
        tanggal: { gte: start, lte: end },
        status: { in: [...DOKUMEN_PENJUALAN_STATUS_SAH] },
      },
      select: {
        id: true,
        noDokumen: true,
        tanggal: true,
        total: true,
        pelanggan: { select: { nama: true } },
        tagihan: { select: { jenis: true } },
      },
      orderBy: [{ tanggal: "asc" }],
    }),
    prisma.fakturPembelian.findMany({
      where: { tanggal: { gte: start, lte: end } },
      select: {
        id: true,
        noFaktur: true,
        tanggal: true,
        supplier: { select: { nama: true } },
        items: { select: { kodeAkun: true, jumlah: true } },
      },
      orderBy: [{ tanggal: "asc" }],
    }),
    prisma.riwayatStok.findMany({
      where: {
        jenis: "MASUK",
        sumber: "PENYESUAIAN",
        nilaiPerSatuan: { not: null },
        tanggal: { gte: start, lte: end },
      },
      select: {
        id: true,
        tanggal: true,
        jumlah: true,
        nilaiPerSatuan: true,
        barang: { select: { id: true, namaBarang: true, kodeAkunCOA: true, kategori: true } },
      },
      orderBy: [{ tanggal: "asc" }],
    }),
    prisma.riwayatStok.findMany({
      where: {
        jenis: "MASUK",
        sumber: { in: ["PENYESUAIAN", "PEMBELIAN"] },
        nilaiPerSatuan: { not: null },
        tanggal: { lte: end },
      },
      select: {
        jumlah: true,
        nilaiPerSatuan: true,
        barangId: true,
      },
    }),
    prisma.riwayatStok.findMany({
      where: {
        jenis: "KELUAR",
        sumber: "PENJUALAN",
        tanggal: { gte: start, lte: end },
      },
      select: {
        id: true,
        tanggal: true,
        jumlah: true,
        barang: { select: { id: true, namaBarang: true, kodeAkunCOA: true, kategori: true } },
      },
      orderBy: [{ tanggal: "asc" }],
    }),
  ]);

  if (rows.length > BATAS_BARIS) {
    throw new Error("Terlalu banyak transaksi pada periode ini — persempit rentang tanggal");
  }

  const namaAkun = new Map(akunDb.map((a) => [a.kode, a.nama]));
  const kodeByNama = new Map(akunDb.map((a) => [a.nama.trim().toLowerCase(), a.kode]));
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
      let kode = r.kodeAkun?.trim() || "";
      if (isTerimaPiutang(r)) kode = "1102";
      legs.push({ kode: kasAsal, nama: nama(kasAsal), debit: nilai, kredit: 0 });
      legs.push({
        kode: kode || "-",
        nama: kode ? nama(kode) : r.kategori || "Pemasukan",
        debit: 0,
        kredit: nilai,
      });
    } else {
      // PENGELUARAN
      let kode = r.kodeAkun?.trim() || "";
      if (r.tag === "BAYAR_UTANG") kode = "2101";
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

  // --- Jurnal dari Dokumen Penjualan PENAGIHAN ---
  const AKUN_PENDAPATAN_BY_JENIS: Record<string, string> = {
    HASIL_KEBUN: "4101",
    TERNAK: "4102",
    LAINNYA: "4104",
  };
  const NAMA_PENDAPATAN_BY_JENIS: Record<string, string> = {
    HASIL_KEBUN: "pendapatan penjualan hasil kebun",
    TERNAK: "pendapatan penjualan ternak (ayam)",
    LAINNYA: "pendapatan lain-lain",
  };
  for (const d of dokumenPenjualan) {
    const nilai = num(d.total);
    if (nilai === 0) continue;
    const jenis = d.tagihan?.jenis ?? "LAINNYA";
    const kodePendapatan =
      kodeByNama.get(NAMA_PENDAPATAN_BY_JENIS[jenis] ?? NAMA_PENDAPATAN_BY_JENIS.LAINNYA) ??
      AKUN_PENDAPATAN_BY_JENIS[jenis] ??
      AKUN_PENDAPATAN_BY_JENIS.LAINNYA;
    const legsInv: JurnalLeg[] = [
      { kode: "1102", nama: nama("1102"), debit: nilai, kredit: 0 },
      { kode: kodePendapatan, nama: nama(kodePendapatan), debit: 0, kredit: nilai },
    ];
    const totalDebit = nilai;
    const totalKredit = nilai;
    grandTotalDebit += totalDebit;
    grandTotalKredit += totalKredit;
    const uraianInv = `Penjualan — ${d.pelanggan?.nama ?? "-"} — Invoice ${d.noDokumen}`;
    voucher.push({
      id: `inv-${d.id}`,
      noTransaksi: d.noDokumen,
      tanggal: d.tanggal.toISOString(),
      uraian: uraianInv,
      legs: legsInv,
      totalDebit,
      totalKredit,
    });
  }

  // --- Jurnal dari Faktur Pembelian ---
  for (const f of fakturPembelian) {
    const items = f.items.filter(i => i.kodeAkun && num(i.jumlah) > 0);
    if (items.length === 0) continue;
    const total = items.reduce((s, i) => s + num(i.jumlah), 0);
    if (total === 0) continue;
    const legsFak: JurnalLeg[] = [];
    for (const it of items) {
      const kode = it.kodeAkun?.trim() || "-";
      legsFak.push({ kode, nama: nama(kode), debit: num(it.jumlah), kredit: 0 });
    }
    legsFak.push({ kode: "2101", nama: nama("2101"), debit: 0, kredit: total });
    const totalDebit = total;
    const totalKredit = total;
    grandTotalDebit += totalDebit;
    grandTotalKredit += totalKredit;
    const uraianFak = `Pembelian — ${f.supplier?.nama ?? "-"} — Faktur ${f.noFaktur}`;
    voucher.push({
      id: `fak-${f.id}`,
      noTransaksi: f.noFaktur,
      tanggal: f.tanggal.toISOString(),
      uraian: uraianFak,
      legs: legsFak,
      totalDebit,
      totalKredit,
    });
  }

  // --- Helper akun persediaan : sama dengan logika Neraca ---
  const getAkunPersediaanKode = (barang: { kodeAkunCOA?: string|null; kategori?: string|null }) => {
    if (barang.kodeAkunCOA?.trim()) return barang.kodeAkunCOA.trim();
    const mapping = getCOAMappingByKategori(barang.kategori as any);
    if (!mapping) return "";
    // 1. cari akun di COA berdasarkan nama mapping (seperti Neraca)
    const namaTarget = mapping.namaAkunPersediaan.trim().toLowerCase();
    const kodeDinamis = akunDb.find(a => a.nama.trim().toLowerCase() === namaTarget)?.kode;
    if (kodeDinamis) return kodeDinamis;
    // 2. fallback ke kode dari mapping bila ada di COA
    const kodeMapping = mapping.kodeAkunPersediaan?.trim();
    if (kodeMapping && akunDb.some(a => a.kode === kodeMapping)) return kodeMapping;
    return "";
  };

  // --- Jurnal Opname bernilai ---
  for (const o of riwayatOpname) {
    const nilai = num(o.jumlah) * num(o.nilaiPerSatuan);
    if (nilai === 0) continue;
    const barang = o.barang;
    if (!barang) continue;
    const kodePersediaan = getAkunPersediaanKode(barang);
    if (!kodePersediaan) continue;
    const legsOp: JurnalLeg[] = [
      { kode: kodePersediaan, nama: nama(kodePersediaan), debit: nilai, kredit: 0 },
      { kode: "SALDO_AWAL", nama: "Saldo Awal Persediaan", debit: 0, kredit: nilai },
    ];
    const total = nilai;
    grandTotalDebit += total;
    grandTotalKredit += total;
    const uraianOp = `Opname — ${barang.namaBarang} — ${num(o.jumlah)} unit`;
    voucher.push({
      id: `opn-${o.id}`,
      noTransaksi: `OPN-${o.id.slice(0,8)}`,
      tanggal: o.tanggal.toISOString(),
      uraian: uraianOp,
      legs: legsOp,
      totalDebit: total,
      totalKredit: total,
    });
  }

  // --- Jurnal HPP penjualan ---
  const masukQtyByBarang = new Map<string, number>();
  const masukNilaiByBarang = new Map<string, number>();
  for (const r of riwayatMasukAll) {
    const qty = num(r.jumlah);
    const nilai = qty * num(r.nilaiPerSatuan);
    const id = r.barangId;
    masukQtyByBarang.set(id, (masukQtyByBarang.get(id) ?? 0) + qty);
    masukNilaiByBarang.set(id, (masukNilaiByBarang.get(id) ?? 0) + nilai);
  }
  for (const k of riwayatKeluar) {
    const qty = num(k.jumlah);
    if (qty === 0) continue;
    const barang = k.barang;
    if (!barang) continue;
    const id = barang.id;
    const masukQty = masukQtyByBarang.get(id) ?? 0;
    const masukNilai = masukNilaiByBarang.get(id) ?? 0;
    if (masukQty === 0 || masukNilai === 0) continue;
    const avgCost = masukNilai / masukQty;
    const nilaiHpp = Math.round(qty * avgCost);
    if (nilaiHpp === 0) continue;
    const kodePersediaan = getAkunPersediaanKode(barang);
    if (!kodePersediaan) continue;
    const legsHpp: JurnalLeg[] = [
      { kode: "HPP", nama: "Harga Pokok Penjualan", debit: nilaiHpp, kredit: 0 },
      { kode: kodePersediaan, nama: nama(kodePersediaan), debit: 0, kredit: nilaiHpp },
    ];
    grandTotalDebit += nilaiHpp;
    grandTotalKredit += nilaiHpp;
    const uraianHpp = `HPP — ${barang.namaBarang} — ${qty} unit`;
    voucher.push({
      id: `hpp-${k.id}`,
      noTransaksi: `HPP-${k.id.slice(0,8)}`,
      tanggal: k.tanggal.toISOString(),
      uraian: uraianHpp,
      legs: legsHpp,
      totalDebit: nilaiHpp,
      totalKredit: nilaiHpp,
    });
  }

  // Urutkan kronologis
  voucher.sort((a, b) => {
    const ta = new Date(a.tanggal).getTime();
    const tb = new Date(b.tanggal).getTime();
    if (ta !== tb) return ta - tb;
    return (a.noTransaksi ?? "").localeCompare(b.noTransaksi ?? "");
  });

  const catatan: string[] = [
    "Setiap transaksi kas tercatat sebagai satu voucher dua kaki (debit = kredit).",
    "Kas/Bank/Tabungan memakai akun 1101/1103/1104 sesuai sumber dana; TRANSFER mencatat perpindahan antar kas.",
    "Jurnal memuat transaksi kas, invoice penjualan, faktur pembelian, opname bernilai, dan HPP.",
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
