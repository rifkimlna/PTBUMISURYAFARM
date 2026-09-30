// Service Laporan Laba Rugi PT Bumi Surya Farm (KHUSUS modul Laporan Laba Rugi).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Data aktual database, tanpa dummy (periode = rentang, bukan kumulatif):
// - Penjualan (4101-4103): DokumenPenjualan PENAGIHAN (by tanggal dokumen,
//   jenis -> kode via AKUN_PENDAPATAN_BY_JENIS) + TransaksiKas PEMASUKAN tunai
//   langsung (tagihanId null, kode 4101-4103). Penerimaan piutang (4105 / kas
//   bertagihan) DIKECUALIKAN agar tidak ganda dengan penjualan yang sudah
//   diakui saat penagihan.
// - Diskon Penjualan: agregat diskon per baris item Penagihan. Retur: belum
//   ada modelnya -> Rp 0 + catatan.
// - HPP: nilai barang KELUAR (RiwayatStok KELUAR x harga satuan) dalam periode.
// - Diskon Pembelian: agregat diskon per baris item FakturPembelian.
// - Biaya (diitung SEKALI per kejadian akuntansi):
//     * Biaya.tanggal dalam periode (tunai maupun hutang — kaki kas/tagihan
//       yang tertaut dikecualikan dari sumber lain);
//     * TransaksiKas PENGELUARAN tanpa tagihan, kecuali kaki akuisisi aset,
//       pembelian persediaan (1105-1107 / 12xx), dan yang tertaut ke Biaya.
// - Operasional vs Lainnya via golongan COA: "Pelunasan Hutang" (5501) masuk
//   Biaya Lainnya; sisanya Operasional. Utang HUTANG terbentuk tanpa dokumen
//   pendukung (tanpa Faktur/Biaya/Aset) masuk Biaya Lainnya + catatan.
// - Pendapatan Lainnya: kas 4104 + kas pemasukan tanpa mapping.
// - Laba Bersih -> Total Komprehensif (sistem belum punya OCI) + catatan.

import { prisma } from "@/lib/prisma";
import { kodeAkunByNama } from "@/lib/coa";
import { AKUN_PENDAPATAN_BY_JENIS } from "@/lib/penjualan-server";
import type {
  LabaRugiBaris,
  LabaRugiKelompok,
  LabaRugiPeriode,
  LabaRugiSnapshot,
} from "@/lib/laba-rugi-types";

export { LABA_RUGI_PERIODE, LABA_RUGI_PERIODE_LABEL } from "@/lib/laba-rugi-types";
export type { LabaRugiBaris, LabaRugiKelompok, LabaRugiPeriode, LabaRugiSnapshot } from "@/lib/laba-rugi-types";

// ---------- Rentang periode (kalender lokal, pola yang sama dengan Neraca) ----------

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

export function resolveLabaRugiRange(
  periode: LabaRugiPeriode,
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

const NAMA_AKUN_FALLBACK: Record<string, string> = {
  "4101": "Pendapatan Penjualan Hasil Kebun",
  "4102": "Pendapatan Penjualan Ternak (Ayam)",
  "4103": "Pendapatan Penjualan Ikan",
  "4104": "Pendapatan Lain-lain",
};

function kelompok(judul: string, map: Map<string, { nama: string; nilai: number }>): LabaRugiKelompok {
  const baris: LabaRugiBaris[] = [...map.entries()]
    .sort()
    .filter(([, v]) => v.nilai !== 0)
    .map(([kode, v]) => ({ kode, nama: v.nama, nilai: Math.round(v.nilai) }));
  return { judul, baris, total: baris.reduce((s, b) => s + b.nilai, 0) };
}

export async function getLabaRugiSnapshot(
  start: Date,
  end: Date,
  periode: LabaRugiPeriode,
  label: string
): Promise<LabaRugiSnapshot> {
  const dalam = { gte: start, lte: end };
  const num = (v: unknown) => Math.round(Number(v ?? 0));

  const [penagihan, kasMasuk, stokKeluar, faktur, biayaList, kasKeluar, asetKasIds, asetTagihanIds, biayaKasIds, hutangLepas, akunDb] =
    await Promise.all([
      prisma.dokumenPenjualan.findMany({
        where: { tipe: "PENAGIHAN", tanggal: dalam },
        select: {
          total: true,
          tagihan: { select: { jenis: true } },
          items: { select: { kuantitas: true, harga: true, diskonPersen: true } },
        },
      }),
      prisma.transaksiKas.findMany({
        where: { tipe: "PEMASUKAN", tanggal: dalam, tagihanId: null },
        select: { kodeAkun: true, kategori: true, jumlah: true },
      }),
      prisma.riwayatStok.findMany({
        where: { jenis: "KELUAR", tanggal: dalam },
        select: {
          jumlah: true,
          barang: { select: { hargaSatuan: true, hargaBeli: true } },
        },
      }),
      prisma.fakturPembelian.findMany({
        where: { tanggal: dalam },
        select: { items: { select: { kuantitas: true, harga: true, diskonPersen: true } } },
      }),
      prisma.biaya.findMany({
        where: { tanggal: dalam },
        select: { kodeAkun: true, kategori: true, jumlah: true },
      }),
      prisma.transaksiKas.findMany({
        where: { tipe: "PENGELUARAN", tanggal: dalam, tagihanId: null },
        select: { id: true, kodeAkun: true, kategori: true, jumlah: true },
      }),
      prisma.aset.findMany({ where: { transaksiKasId: { not: null } }, select: { transaksiKasId: true } }),
      prisma.aset.findMany({ where: { tagihanId: { not: null } }, select: { tagihanId: true } }),
      prisma.biaya.findMany({ where: { transaksiKasId: { not: null } }, select: { transaksiKasId: true } }),
      prisma.tagihan.findMany({
        where: { tipe: "HUTANG", tanggal: dalam, fakturPembelian: null, biaya: null },
        select: { id: true, pihak: true, jumlah: true },
      }),
      prisma.akunCOA.findMany({
        where: { isActive: true },
        select: { kode: true, nama: true, golongan: true, kelompok: true },
      }),
    ]);

  const coa = new Map(akunDb.map((a) => [a.kode, a]));
  const namaAkun = (kode: string) =>
    coa.get(kode)?.nama ?? NAMA_AKUN_FALLBACK[kode] ?? `Akun ${kode}`;

  const catatan: string[] = [];
  const tambah = (map: Map<string, { nama: string; nilai: number }>, kode: string, nama: string, nilai: number) => {
    const cur = map.get(kode) ?? { nama, nilai: 0 };
    cur.nilai += nilai;
    map.set(kode, cur);
  };

  // --- Pendapatan penjualan ---
  const penjualanMap = new Map<string, { nama: string; nilai: number }>();
  let diskonPenjualan = 0;
  for (const d of penagihan) {
    const kode = AKUN_PENDAPATAN_BY_JENIS[(d.tagihan?.jenis ?? "LAINNYA") as keyof typeof AKUN_PENDAPATAN_BY_JENIS];
    tambah(penjualanMap, kode, namaAkun(kode), num(d.total));
    for (const it of d.items) {
      diskonPenjualan += Number(it.kuantitas) * Number(it.harga) * (Number(it.diskonPersen) / 100);
    }
  }
  diskonPenjualan = Math.round(diskonPenjualan);

  const pendapatanLainMap = new Map<string, { nama: string; nilai: number }>();
  let piutangTertagih = 0;
  for (const k of kasMasuk) {
    const kode = k.kodeAkun?.trim() || kodeAkunByNama("PEMASUKAN", k.kategori) || "";
    const nilai = num(k.jumlah);
    if (kode === "4105") {
      piutangTertagih += nilai; // penerimaan piutang: bukan pendapatan baru
    } else if (kode === "4101" || kode === "4102" || kode === "4103") {
      tambah(penjualanMap, kode, namaAkun(kode), nilai); // penjualan tunai langsung
    } else if (kode) {
      tambah(pendapatanLainMap, kode, namaAkun(kode), nilai);
    } else {
      tambah(pendapatanLainMap, "(tanpa kode)", k.kategori || "Pemasukan lain", nilai);
      catatan.push("Ada pemasukan tunai tanpa mapping COA — disajikan di Pendapatan Lainnya.");
    }
  }
  const penjualan = kelompok("Pendapatan dari Penjualan", penjualanMap);
  const returPenjualan = 0;
  catatan.push("Retur penjualan disajikan Rp 0 karena belum ada pencatatan retur di sistem.");
  const totalPendapatan = penjualan.total - diskonPenjualan - returPenjualan;

  // --- HPP ---
  let hppNilai = 0;
  let hppItem = 0;
  for (const r of stokKeluar) {
    const harga = Number(r.barang?.hargaSatuan ?? r.barang?.hargaBeli ?? 0);
    hppNilai += Math.round(Number(r.jumlah) * harga);
    hppItem += Number(r.jumlah);
  }
  let diskonPembelian = 0;
  for (const f of faktur) {
    for (const it of f.items) {
      diskonPembelian += Number(it.kuantitas) * Number(it.harga) * (Number(it.diskonPersen) / 100);
    }
  }
  diskonPembelian = Math.round(diskonPembelian);
  const hpp = kelompok(
    "Harga Pokok Penjualan",
    new Map(hppNilai !== 0 ? [["HPP", { nama: "Harga Pokok Penjualan", nilai: hppNilai }]] : [])
  );
  if (hppItem > 0) catatan.push(`HPP dihitung dari ${hppItem} satuan barang keluar x harga satuan.`);
  else catatan.push("Belum ada barang keluar pada periode ini sehingga HPP Rp 0.");
  const totalHpp = hpp.total - diskonPembelian;
  const labaKotor = totalPendapatan - totalHpp;

  // --- Biaya (sekali hitung per kejadian) ---
  const asetKas = new Set(asetKasIds.map((a) => a.transaksiKasId));
  const biayaKas = new Set(biayaKasIds.map((b) => b.transaksiKasId));
  const asetHutang = new Set(asetTagihanIds.map((a) => a.tagihanId));

  const operasionalMap = new Map<string, { nama: string; nilai: number }>();
  const lainnyaMap = new Map<string, { nama: string; nilai: number }>();
  const golonganOf = (kode: string) => coa.get(kode)?.golongan ?? "";
  const taruhBeban = (kode: string, nama: string, nilai: number, asal: string) => {
    if (nilai === 0) return;
    if (golonganOf(kode) === "Pelunasan Hutang") {
      tambah(lainnyaMap, kode, nama, nilai);
    } else {
      if (!coa.get(kode)) {
        tambah(operasionalMap, "(tanpa kode)", `${nama} (${asal})`, nilai);
        catatan.push(`Ada beban tanpa mapping COA (“${nama}”) — disajikan di Biaya Operasional.`);
      } else {
        tambah(operasionalMap, kode, nama, nilai);
      }
    }
  };

  for (const b of biayaList) {
    const kode = b.kodeAkun?.trim() || "";
    taruhBeban(kode, kode ? namaAkun(kode) : b.kategori, num(b.jumlah), "Biaya");
  }
  for (const k of kasKeluar) {
    if (asetKas.has(k.id) || biayaKas.has(k.id)) continue; // kaki aset / kaki biaya tunai
    const kode = k.kodeAkun?.trim() || kodeAkunByNama("PENGELUARAN", k.kategori) || "";
    if (kode === "1105" || kode === "1106" || kode === "1107") continue; // pembelian persediaan
    if (/^12/.test(kode)) continue; // akuisisi aset tetap
    taruhBeban(kode, kode ? namaAkun(kode) : k.kategori, num(k.jumlah), "Kas");
  }

  // Utang terbentuk tanpa dokumen pendukung (tanpa Faktur/Biaya/Aset)
  let hutangTanpaDokumen = 0;
  for (const h of hutangLepas) {
    if (asetHutang.has(h.id)) continue; // kaki akuisisi aset kredit
    const nilai = num(h.jumlah);
    hutangTanpaDokumen += nilai;
    tambah(lainnyaMap, "HUTANG", `Utang tanpa dokumen — ${h.pihak}`, nilai);
  }
  if (lainnyaMap.has("HUTANG")) {
    catatan.push(
      `Utang Rp ${hutangTanpaDokumen.toLocaleString("id-ID")} terbentuk tanpa Faktur/Biaya/Aset pendukung (akun debit tidak diketahui) — disajikan di Biaya Lainnya.`
    );
  }

  const biayaOperasional = kelompok("Biaya Operasional", operasionalMap);
  if (biayaOperasional.baris.length === 0) catatan.push("Belum ada biaya operasional pada periode ini.");
  const totalBiayaOperasional = biayaOperasional.total;
  const operasionalBersih = labaKotor - totalBiayaOperasional;

  const pendapatanLainnya = kelompok("Pendapatan Lainnya", pendapatanLainMap);
  if (pendapatanLainnya.baris.length === 0) catatan.push("Belum ada pendapatan lainnya pada periode ini.");
  if (piutangTertagih > 0) {
    catatan.push(
      `Penerimaan piutang Rp ${piutangTertagih.toLocaleString("id-ID")} tidak dihitung sebagai pendapatan baru (sudah diakui saat penagihan).`
    );
  }
  const totalPendapatanLainnya = pendapatanLainnya.total;

  const biayaLainnya = kelompok("Biaya Lainnya", lainnyaMap);
  if (biayaLainnya.baris.length === 0) catatan.push("Belum ada biaya lainnya pada periode ini.");
  else if (lainnyaMap.has("5501")) {
    catatan.push("Akun Pelunasan Hutang Usaha (5501) disajikan di Biaya Lainnya sebagai pelunasan kewajiban.");
  }
  const totalBiayaLainnya = biayaLainnya.total;

  const labaBersih = operasionalBersih + totalPendapatanLainnya - totalBiayaLainnya;
  const totalKomprehensif = labaBersih;
  catatan.push("Sistem belum mencatat pendapatan komprehensif lain, sehingga total komprehensif sama dengan laba bersih.");

  return {
    periode,
    start: start.toISOString(),
    end: end.toISOString(),
    label,
    penjualan,
    diskonPenjualan,
    returPenjualan,
    totalPendapatan,
    hpp,
    diskonPembelian,
    totalHpp,
    labaKotor,
    biayaOperasional,
    totalBiayaOperasional,
    operasionalBersih,
    pendapatanLainnya,
    totalPendapatanLainnya,
    biayaLainnya,
    totalBiayaLainnya,
    labaBersih,
    totalKomprehensif,
    catatan: [...new Set(catatan)],
  };
}

/** Snapshot per bulan (Januari s/d bulan berjalan) untuk "per-bulan-tahun-ini". */
export async function getLabaRugiBulanan(): Promise<LabaRugiSnapshot[]> {
  const out: LabaRugiSnapshot[] = [];
  for (const m of monthRangesOfCurrentYear()) {
    out.push(await getLabaRugiSnapshot(m.start, m.end, "per-bulan-tahun-ini", m.label));
  }
  return out;
}
