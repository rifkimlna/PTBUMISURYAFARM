// Service Laporan Neraca PT Bumi Surya Farm (KHUSUS modul Laporan Neraca).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Sumber data (semuanya data aktual database, tanpa dummy):
// - Kas/Bank/Tabungan (1101/1103/1104): TransaksiKas s/d tanggal laporan,
//   transfer-aware (TRANSFER keluar mengurangi asal, menambah tujuan).
// - Piutang (1102): sisa Tagihan PIUTANG yang belum lunas s/d tanggal laporan.
// - Persediaan (1105/1106/1107): stok berjalan (stokAwal + MASUK - KELUAR
//   dari RiwayatStok s/d tanggal laporan) x harga satuan.
// - Aset Tetap (1201-1207): master Aset yang belum dilepas/dijual dan tanggal
//   perolehannya <= tanggal laporan (biayaAkuisisi ?? nilaiAset).
// - Penyusutan: akumulasi informatif via hitungSusut() s/d tanggal laporan
//   (belum dijurnal otomatis — akun akumulasi memang belum ada di COA).
// - Utang Usaha (2101): sisa Tagihan HUTANG yang belum lunas s/d tanggal laporan.
//   Akun utang lain (2102-2104) belum punya sumber data -> disajikan Rp 0.
// - Modal: setoran pemilik dari TransaksiKas berkode akun 31xx s/d tanggal
//   laporan (PEMASUKAN = tambah, PENGELUARAN = kurang; TRANSFER dikecualikan).
//     * 3104 "Laba Ditahan" = laba basis kas (PEMASUKAN - PENGELUARAN
//       non-transfer dan non-modal 31xx, konsisten dengan Laba Rugi);
//     * selisih penyeimbang (Total Aktiva - Total Kewajiban - Laba - Modal
//       tercatat) disajikan sebagai "Modal Disetor (implisit)" agar persamaan
//       Total Aktiva = Total Kewajiban dan Modal selalu terpenuhi; nilainya
//       menuju Rp 0 bila seluruh setoran sudah dicatat via Setor Modal.
//   Ketiga komponen modal diberi catatan penjelasan di laporan.

import { prisma } from "@/lib/prisma";
import { hitungSusut } from "@/lib/aset";
import { getCOAMappingByKategori } from "@/lib/persediaan-coa-mapping";
import type { NeracaBaris, NeracaKelompok, NeracaPeriode, NeracaSnapshot } from "@/lib/neraca-types";

export { NERACA_PERIODE, NERACA_PERIODE_LABEL } from "@/lib/neraca-types";
export type { NeracaBaris, NeracaKelompok, NeracaPeriode, NeracaSnapshot } from "@/lib/neraca-types";

// ---------- Rentang periode (kalender lokal) ----------

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

/**
 * Neraca adalah laporan pada satu titik waktu: angka dihitung kumulatif
 * s/d akhir periode (`end`). Periode berjalan dibatasi maksimal saat ini
 * agar tidak mencakup tanggal masa depan.
 */
export function resolveNeracaRange(
  periode: NeracaPeriode,
  dari?: string,
  sampai?: string
): { start: Date; end: Date; label: string } {
  const now = new Date();
  const today = startOfDay(now);
  const cap = (d: Date) => (d.getTime() > now.getTime() ? endOfDay(now) : endOfDay(d));

  switch (periode) {
    case "hari-ini":
      return { start: today, end: endOfDay(now), label: fmtTgl(today) };
    case "kemarin": {
      const y = addDays(today, -1);
      return { start: y, end: endOfDay(y), label: fmtTgl(y) };
    }
    case "pekan-ini": {
      const dow = (today.getDay() + 6) % 7; // Senin = 0
      const s = addDays(today, -dow);
      const e = addDays(s, 6);
      return { start: s, end: cap(e), label: `${fmtTgl(s)} – ${fmtTgl(e)}` };
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
      return { start: s, end: endOfDay(now), label: `${fmtTgl(s)} – ${fmtTgl(now)}` };
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
      return { start: s, end: endOfDay(now), label: `${fmtTgl(s)} – ${fmtTgl(now)}` };
    }
    case "kuartal-lalu": {
      const q = Math.floor(now.getMonth() / 3) - 1;
      const s = new Date(now.getFullYear(), q * 3, 1);
      const last = new Date(s.getFullYear(), s.getMonth() + 3, 0);
      return { start: s, end: endOfDay(last), label: `${fmtTgl(s)} – ${fmtTgl(last)}` };
    }
    case "tahun-ini": {
      const s = new Date(now.getFullYear(), 0, 1);
      return { start: s, end: endOfDay(now), label: `${fmtTgl(s)} – ${fmtTgl(now)}` };
    }
    case "tahun-lalu": {
      const s = new Date(now.getFullYear() - 1, 0, 1);
      const last = new Date(now.getFullYear() - 1, 11, 31);
      return { start: s, end: endOfDay(last), label: `${fmtTgl(s)} – ${fmtTgl(last)}` };
    }
    case "per-bulan-tahun-ini": {
      const s = new Date(now.getFullYear(), 0, 1);
      return {
        start: s,
        end: endOfDay(now),
        label: `Januari – Desember ${now.getFullYear()}`,
      };
    }
    case "custom": {
      if (!dari || !sampai) throw new Error("Periode custom membutuhkan tanggal dari & sampai");
      const s = startOfDay(new Date(dari));
      const e = new Date(sampai);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()))
        throw new Error("Tanggal custom tidak valid");
      if (endOfDay(e) < s) throw new Error("Tanggal 'sampai' tidak boleh lebih awal dari 'dari'");
      return { start: s, end: endOfDay(e), label: `${fmtTgl(s)} – ${fmtTgl(e)}` };
    }
  }
}

/** Titik akhir bulan dari Januari s/d bulan berjalan (bulan depan belum terjadi). */
export function monthEndsOfCurrentYear(): { asOf: Date; label: string }[] {
  const now = new Date();
  const y = now.getFullYear();
  const out: { asOf: Date; label: string }[] = [];
  for (let m = 0; m <= now.getMonth(); m++) {
    const last = new Date(y, m + 1, 0);
    out.push({
      asOf: m === now.getMonth() ? endOfDay(now) : endOfDay(last),
      label: last.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
    });
  }
  return out;
}

// ---------- Mapping kategori aset -> kode COA ----------

const KODE_ASET_BY_KATEGORI: Record<string, string> = {
  Tanah: "1201",
  "Bangunan & Instalasi": "1202",
  "Bangunan dan Instalasi": "1202",
  "Mesin & Peralatan Pertanian/Peternakan": "1203",
  "Mesin dan Peralatan Pertanian/Peternakan": "1203",
  "Perabotan & Peralatan Kantor/Villa": "1204",
  "Perabotan dan Peralatan Kantor/Villa": "1204",
  "Tanaman Produktif": "1205",
  Ternak: "1206",
  "Ikan Budidaya": "1207",
};

const NAMA_AKUN_FALLBACK: Record<string, string> = {
  "1101": "Kas",
  "1102": "Piutang",
  "1103": "Bank",
  "1104": "Tabungan",
  "1105": "Persediaan Pupuk & Obat-obatan",
  "1106": "Persediaan Pakan Ternak/Ikan",
  "1107": "Persediaan Bibit/Benih",
  "1201": "Tanah",
  "1202": "Bangunan dan Instalasi",
  "1203": "Mesin dan Peralatan Pertanian/Peternakan",
  "1204": "Perabotan dan Peralatan Kantor/Villa",
  "1205": "Tanaman Produktif",
  "1206": "Ternak",
  "1207": "Ikan Budidaya",
  "2101": "Utang Usaha",
  "2102": "Utang Gaji / Kasbon Karyawan",
  "2103": "Utang Pajak",
  "2104": "Utang Lain-lain",
  "3101": "Modal Disetor / Setoran Pemilik (Bapak)",
  "3102": "Modal Disetor / Setoran Pemilik (Riki)",
  "3103": "Prive / Penarikan Modal",
  "3104": "Laba Ditahan (Akumulasi)",
};

// ---------- Perhitungan snapshot ----------

export async function getNeracaSnapshot(
  asOf: Date,
  periode: NeracaPeriode,
  label: string,
  start: Date
): Promise<NeracaSnapshot> {
  const lte = { lte: asOf };

  const [kasRows, kasTujuanRows, piutangAgg, hutangAgg, barang, stokRows, asetList, akunDb, modal31Rows] =
    await Promise.all([
      prisma.transaksiKas.groupBy({
        by: ["sumberDana", "tipe"],
        where: { tanggal: lte },
        _sum: { jumlah: true },
      }),
      prisma.transaksiKas.groupBy({
        by: ["sumberDanaTujuan", "tipe"],
        where: { tanggal: lte },
        _sum: { jumlah: true },
      }),
      prisma.tagihan.aggregate({
        where: { tipe: "PIUTANG", status: { not: "LUNAS" }, tanggal: lte },
        _sum: { sisa: true },
      }),
      prisma.tagihan.aggregate({
        where: { tipe: "HUTANG", status: { not: "LUNAS" }, tanggal: lte },
        _sum: { sisa: true },
      }),
      prisma.persediaanBarang.findMany({
        select: {
          id: true,
          kategori: true,
          kodeAkunCOA: true,
          stokAwal: true,
          hargaSatuan: true,
          hargaBeli: true,
        },
      }),
      prisma.riwayatStok.groupBy({
        by: ["barangId", "jenis"],
        where: { tanggal: lte },
        _sum: { jumlah: true },
      }),
      prisma.aset.findMany({
        select: {
          namaAset: true,
          kategori: true,
          nilaiAset: true,
          tanggalPerolehan: true,
          statusAset: true,
          biayaAkuisisi: true,
          akunAset: true,
          tanggalAkuisisi: true,
          metodeSusut: true,
          masaManfaatBulan: true,
          nilaiResidu: true,
          tanggalMulaiSusut: true,
        },
      }),
      prisma.akunCOA.findMany({
        where: { isActive: true },
        select: { kode: true, nama: true, kelompok: true },
      }),
      // Mutasi modal tercatat (setoran via Setor Modal) s/d tanggal laporan.
      prisma.transaksiKas.groupBy({
        by: ["kodeAkun", "tipe"],
        where: { tanggal: lte, kodeAkun: { startsWith: "31" }, tipe: { in: ["PEMASUKAN", "PENGELUARAN"] } },
        _sum: { jumlah: true },
      }),
    ]);

  const namaAkun = (kode: string) =>
    akunDb.find((a) => a.kode === kode)?.nama ?? NAMA_AKUN_FALLBACK[kode] ?? kode;

  const num = (v: unknown) => Math.round(Number(v ?? 0));

  // --- Kas & setara (transfer-aware, sama dengan getSaldoPerSumber + batas asOf) ---
  const saldoSumber = (sumber: string) => {
    const masuk = num(
      kasRows.find((r) => r.sumberDana === sumber && r.tipe === "PEMASUKAN")?._sum.jumlah
    );
    const keluar = num(
      kasRows.find((r) => r.sumberDana === sumber && r.tipe === "PENGELUARAN")?._sum.jumlah
    );
    const trfOut = num(
      kasRows.find((r) => r.sumberDana === sumber && r.tipe === "TRANSFER")?._sum.jumlah
    );
    const trfIn = num(
      kasTujuanRows.find((r) => r.sumberDanaTujuan === sumber && r.tipe === "TRANSFER")?._sum
        .jumlah
    );
    return masuk - keluar - trfOut + trfIn;
  };

  // --- Laba basis kas (konsisten dengan seksi laba-rugi dashboard).
  // Setoran/penarikan modal 31xx dikecualikan — bukan laba.
  let pemasukan = 0;
  let pengeluaran = 0;
  for (const r of kasRows) {
    if (r.tipe === "PEMASUKAN") pemasukan += num(r._sum.jumlah);
    else if (r.tipe === "PENGELUARAN") pengeluaran += num(r._sum.jumlah);
  }
  let modalMasuk = 0;
  let modalKeluar = 0;
  const netModal = (kode: string) => {
    const masuk = num(modal31Rows.find((r) => r.kodeAkun === kode && r.tipe === "PEMASUKAN")?._sum.jumlah);
    const keluar = num(modal31Rows.find((r) => r.kodeAkun === kode && r.tipe === "PENGELUARAN")?._sum.jumlah);
    return masuk - keluar;
  };
  for (const r of modal31Rows) {
    if (r.tipe === "PEMASUKAN") modalMasuk += num(r._sum.jumlah);
    else if (r.tipe === "PENGELUARAN") modalKeluar += num(r._sum.jumlah);
  }
  const labaBasisKas = pemasukan - modalMasuk - (pengeluaran - modalKeluar);

  // --- Persediaan: agregasi per kode akun COA ---
  const stokByBarang = new Map<string, number>();
  for (const r of stokRows) {
    const cur = stokByBarang.get(r.barangId) ?? 0;
    stokByBarang.set(
      r.barangId,
      cur + (r.jenis === "MASUK" ? num(r._sum.jumlah) : -num(r._sum.jumlah))
    );
  }
  const nilaiPersediaan = new Map<string, number>();
  for (const b of barang) {
    const qty = (b.stokAwal ?? 0) + (stokByBarang.get(b.id) ?? 0);
    if (qty === 0) continue;
    const harga = Number(b.hargaSatuan ?? b.hargaBeli ?? 0);
    const nilai = Math.round(qty * harga);
    if (nilai === 0) continue;
    const kode =
      b.kodeAkunCOA?.trim() ||
      getCOAMappingByKategori(b.kategori as never)?.kodeAkunPersediaan ||
      "";
    const key = kode || "(tanpa kode COA)";
    nilaiPersediaan.set(key, (nilaiPersediaan.get(key) ?? 0) + nilai);
  }

  // --- Aset tetap bruto + akumulasi penyusutan ---
  const brutoByKode = new Map<string, number>();
  let akumulasiSusut = 0;
  const susutDetail: NeracaBaris[] = [];
  for (const a of asetList) {
    if (a.statusAset === "DIJUAL" || a.statusAset === "DILEPAS") continue;
    const tglOleh = a.tanggalAkuisisi ?? a.tanggalPerolehan;
    if (tglOleh && new Date(tglOleh).getTime() > asOf.getTime()) continue;
    const biaya = num(a.biayaAkuisisi ?? a.nilaiAset);
    if (biaya === 0) continue;
    const kode =
      a.akunAset?.trim() && /^\d+$/.test(a.akunAset.trim())
        ? a.akunAset.trim()
        : (KODE_ASET_BY_KATEGORI[a.kategori] ?? "");
    const key = kode || "(tanpa kode COA)";
    brutoByKode.set(key, (brutoByKode.get(key) ?? 0) + biaya);
    const akum = hitungSusut(
      biaya,
      num(a.nilaiResidu),
      a.masaManfaatBulan ?? 0,
      a.metodeSusut,
      a.tanggalMulaiSusut ? new Date(a.tanggalMulaiSusut) : null,
      asOf
    ).akumulasi;
    if (akum > 0) {
      akumulasiSusut += akum;
      susutDetail.push({ kode: key, nama: `Akumulasi — ${a.namaAset}`, nilai: akum });
    }
  }

  // --- Susun kelompok ---
  const barisKas: NeracaBaris[] = [
    { kode: "1101", nama: namaAkun("1101"), nilai: saldoSumber("KAS") },
    { kode: "1103", nama: namaAkun("1103"), nilai: saldoSumber("BANK") },
    { kode: "1104", nama: namaAkun("1104"), nilai: saldoSumber("TABUNGAN") },
    { kode: "1102", nama: namaAkun("1102"), nilai: num(piutangAgg._sum.sisa) },
  ];
  for (const [kode, nilai] of [...nilaiPersediaan.entries()].sort()) {
    barisKas.push({
      kode,
      nama: kode.startsWith("(") ? `Persediaan ${kode}` : namaAkun(kode),
      nilai,
    });
  }
  const aktivaLancar: NeracaKelompok = {
    judul: "Aktiva Lancar",
    baris: barisKas,
    total: barisKas.reduce((s, b) => s + b.nilai, 0),
  };

  const barisTetap: NeracaBaris[] = [...brutoByKode.entries()]
    .sort()
    .map(([kode, nilai]) => ({
      kode,
      nama: kode.startsWith("(") ? `Aset Tetap ${kode}` : namaAkun(kode),
      nilai,
    }));
  const aktivaTetap: NeracaKelompok = {
    judul: "Aktiva Tetap",
    baris: barisTetap,
    total: barisTetap.reduce((s, b) => s + b.nilai, 0),
  };

  const penyusutan: NeracaKelompok = {
    judul: "Depresiasi & Amortisasi",
    baris: susutDetail,
    total: akumulasiSusut,
  };

  const totalAktiva = aktivaLancar.total + aktivaTetap.total - penyusutan.total;

  const barisUtang: NeracaBaris[] = ["2101", "2102", "2103", "2104"].map((kode) => ({
    kode,
    nama: namaAkun(kode),
    nilai: kode === "2101" ? num(hutangAgg._sum.sisa) : 0,
  }));
  const kewajibanLancar: NeracaKelompok = {
    judul: "Kewajiban Lancar",
    baris: barisUtang,
    total: barisUtang.reduce((s, b) => s + b.nilai, 0),
  };
  const totalKewajiban = kewajibanLancar.total;

  // --- Modal: akun tercatat (termasuk akun Modal baru dari Daftar Akun) ---
  const kodeModalSet = new Set<string>(["3101", "3102", "3103", "3104"]);
  for (const a of akunDb) {
    if ((a as { kelompok?: string }).kelompok === "Modal") kodeModalSet.add(a.kode);
  }
  for (const r of modal31Rows) {
    if (r.kodeAkun) kodeModalSet.add(r.kodeAkun);
  }
  const barisModalTercatat: NeracaBaris[] = [...kodeModalSet]
    .sort()
    .filter((kode) => kode !== "3104")
    .map((kode) => ({ kode, nama: namaAkun(kode), nilai: netModal(kode) }));
  const modalSetorTercatat = barisModalTercatat.reduce((s, b) => s + b.nilai, 0);

  const modalImplisit = totalAktiva - totalKewajiban - labaBasisKas - modalSetorTercatat;
  const barisModal: NeracaBaris[] = [
    ...barisModalTercatat,
    { kode: "3104", nama: `${namaAkun("3104")} (basis kas)`, nilai: labaBasisKas },
    {
      kode: "3101/3102",
      nama: "Modal Disetor (implisit — penyeimbang)",
      nilai: modalImplisit,
    },
  ];
  const modal: NeracaKelompok = {
    judul: "Modal Pemilik",
    baris: barisModal,
    total: barisModal.reduce((s, b) => s + b.nilai, 0),
  };
  const totalModal = modal.total;
  const totalKewajibanModal = totalKewajiban + totalModal;

  const catatan: string[] = [];
  if (barisTetap.length === 0)
    catatan.push("Belum ada aset tetap yang memenuhi kriteria pada periode ini.");
  if (susutDetail.length === 0)
    catatan.push(
      "Belum ada akumulasi penyusutan (aset memakai metode non-depresiasi atau belum mulai disusut)."
    );
  if (num(piutangAgg._sum.sisa) === 0)
    catatan.push("Tidak ada piutang terbuka pada periode ini.");
  if (num(hutangAgg._sum.sisa) === 0)
    catatan.push("Tidak ada utang terbuka pada periode ini.");
  if (nilaiPersediaan.size === 0)
    catatan.push("Tidak ada nilai persediaan pada periode ini.");
  catatan.push(
    "Akun 2102–2104 disajikan Rp 0 karena belum ada sumber data (utang gaji/pajak/lain-lain belum dicatat terpisah)."
  );
  catatan.push(
    modalSetorTercatat === 0
      ? "Belum ada setoran modal 31xx yang tercatat — modal disajikan sebagai angka penyeimbang; catat via Kas & Bank → Setor Modal. 3104 memakai laba basis kas."
      : "Modal tercatat berasal dari TransaksiKas berkode akun 31xx (via Setor Modal); sisanya penyeimbang implisit. 3104 memakai laba basis kas."
  );

  return {
    periode,
    start: start.toISOString(),
    end: asOf.toISOString(),
    label,
    aktivaLancar,
    aktivaTetap,
    penyusutan,
    totalAktiva,
    kewajibanLancar,
    totalKewajiban,
    modal,
    totalModal,
    totalKewajibanModal,
    labaBasisKas,
    modalImplisit,
    catatan,
  };
}

/** Snapshot bulanan (akhir tiap bulan tahun berjalan) untuk "per-bulan-tahun-ini". */
export async function getNeracaBulanan(): Promise<NeracaSnapshot[]> {
  const months = monthEndsOfCurrentYear();
  const out: NeracaSnapshot[] = [];
  for (const m of months) {
    const start = new Date(m.asOf.getFullYear(), m.asOf.getMonth(), 1);
    out.push(await getNeracaSnapshot(m.asOf, "per-bulan-tahun-ini", m.label, start));
  }
  return out;
}
