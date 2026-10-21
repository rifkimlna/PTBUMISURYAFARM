// Service Laporan Anggaran (detail per anggaran) PT Bumi Surya Farm.
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Data 100% asli dari AnggaranItem + master AkunCOA, tanpa dummy:
// - Periode = periode tersimpan (tahunMulai/bulanMulai/durasi).
// - Realisasi per akun per bulan memakai snapshot Laba Rugi resmi per bulan
//   (fungsi yang sama dengan laporan Laba Rugi — tidak diubah);
//   Selisih = Realisasi − Anggaran.
// - Klasifikasi section memakai sectionBudgetOf yang sama dengan monitor
//   (Pendapatan Usaha → Revenue; Pendapatan lain → Other Income;
//   Beban non-Pelunasan Hutang → Operational Expense; 5501 → Other Expense).
// - Harga Pokok Penjualan dihitung dari mutasi persediaan sehingga tidak
//   memiliki pasangan akun budget (kolom anggaran Cost of Sales Rp 0,
//   kolom realisasinya mengikuti laporan Laba Rugi).

import { prisma } from "@/lib/prisma";
import { sectionBudgetOf, type BudgetSectionKey, type CoaInfo } from "@/lib/anggaran-monitor-server";
import { getLabaRugiSnapshot } from "@/lib/laba-rugi-server";
import type { MonitorBulan } from "@/lib/anggaran-monitor-types";

export type AnggaranSectionKey = "revenue" | "cos" | "opex" | "otherIncome" | "otherExpense";

export type AnggaranAkunNilai = {
  kode: string;
  nama: string;
  /** Nominal anggaran per bulan periode. */
  bulan: number[];
  total: number;
  /** Realisasi aktual per bulan (dari snapshot Laba Rugi resmi). */
  realisasi: number[];
  realisasiTotal: number;
  /** Selisih = realisasi − anggaran per bulan. */
  selisih: number[];
  selisihTotal: number;
};

export type AnggaranBarisTotal = {
  judul: string;
  bulan: number[];
  total: number;
  realisasi: number[];
  realisasiTotal: number;
  selisih: number[];
  selisihTotal: number;
};

export type AnggaranSection = {
  key: AnggaranSectionKey;
  judul: string;
  akun: AnggaranAkunNilai[];
  totalBulan: number[];
  total: number;
  realisasiBulan: number[];
  realisasiTotal: number;
  selisihBulan: number[];
  selisihTotal: number;
};

export type AnggaranDetailSnapshot = {
  id: string;
  nama: string;
  /** ex: "April 2026 – Juni 2026". */
  label: string;
  bulan: MonitorBulan[];
  revenue: AnggaranSection;
  cos: AnggaranSection;
  grossProfit: AnggaranBarisTotal;
  opex: AnggaranSection;
  opexTotal: AnggaranBarisTotal;
  operatingProfit: AnggaranBarisTotal;
  otherIncome: AnggaranSection;
  otherExpense: AnggaranSection;
  otherTotal: AnggaranBarisTotal;
  profit: AnggaranBarisTotal;
  dibuatOleh: string | null;
  diubahPada: string;
  catatan: string[];
};

const JUDUL: Record<AnggaranSectionKey, string> = {
  revenue: "Revenue",
  cos: "Cost of Sales",
  opex: "Operational Expense",
  otherIncome: "Other Income",
  otherExpense: "Other Expense",
};

function labelPanjang(tahun: number, bulan: number) {
  return new Date(tahun, bulan - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function labelPendek(tahun: number, bulan: number) {
  return new Date(tahun, bulan - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}

export async function getAnggaranDetailSnapshot(anggaranId: string): Promise<AnggaranDetailSnapshot> {
  const anggaran = await prisma.anggaranLabaRugi.findUnique({
    where: { id: anggaranId },
    include: {
      items: { select: { kodeAkun: true, tahun: true, bulan: true, nominal: true } },
      createdBy: { select: { nama: true } },
    },
  });
  if (!anggaran) throw new Error("Anggaran tidak ditemukan");

  const akunDb = await prisma.akunCOA.findMany({
    where: { isActive: true },
    select: { kode: true, nama: true, kelompok: true, golongan: true },
  });
  const coa = new Map<string, CoaInfo>(akunDb.map((a) => [a.kode, { nama: a.nama, kelompok: a.kelompok, golongan: a.golongan }]));

  const bulan: MonitorBulan[] = [];
  for (let i = 0; i < anggaran.durasi; i++) {
    const idx = anggaran.bulanMulai - 1 + i;
    const tahun = anggaran.tahunMulai + Math.floor(idx / 12);
    const bln = (idx % 12) + 1;
    bulan.push({ tahun, bulan: bln, label: labelPanjang(tahun, bln) });
  }

  const dalamPeriode = new Set(bulan.map((b) => `${b.tahun}-${b.bulan}`));
  // Nilai per akun per bulan (hanya item dalam periode; di luar periode diabaikan + dicatat).
  const nilai = new Map<string, number[]>();
  let diLuarPeriode = 0;
  for (const it of anggaran.items) {
    if (!dalamPeriode.has(`${it.tahun}-${it.bulan}`)) {
      diLuarPeriode += 1;
      continue;
    }
    const idx = bulan.findIndex((b) => b.tahun === it.tahun && b.bulan === it.bulan);
    if (idx === -1) continue;
    const arr = nilai.get(it.kodeAkun) ?? bulan.map(() => 0);
    arr[idx] += Math.round(Number(it.nominal) || 0);
    nilai.set(it.kodeAkun, arr);
  }

  // ---------- Realisasi aktual per bulan (snapshot Laba Rugi resmi, tak diubah) ----------
  type AktualBaris = { kode: string; nama: string; nilai: number };
  type AktualBulan = {
    revenue: AktualBaris[];
    cos: AktualBaris[];
    opex: AktualBaris[];
    otherIncome: AktualBaris[];
    otherExpense: AktualBaris[];
    labaKotor: number;
    operasionalBersih: number;
    labaBersih: number;
    totalBiayaOperasional: number;
    totalPendapatanLainnya: number;
    totalBiayaLainnya: number;
  };
  const akhirHari = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };
  const barisAktual = (rows: { kode: string; nama: string; nilai: number }[]): AktualBaris[] =>
    rows.map((r) => ({ kode: r.kode, nama: r.nama, nilai: Math.round(Number(r.nilai) || 0) }));
  const aktualPerBulan: AktualBulan[] = [];
  for (const b of bulan) {
    const start = new Date(b.tahun, b.bulan - 1, 1);
    const end = akhirHari(new Date(b.tahun, b.bulan, 0));
    const s = await getLabaRugiSnapshot(start, end, "custom", labelPendek(b.tahun, b.bulan));
    const revenue = barisAktual(s.penjualan.baris);
    if (Math.round(s.diskonPenjualan) !== 0)
      revenue.push({ kode: "—", nama: "Diskon Penjualan", nilai: -Math.round(s.diskonPenjualan) });
    if (Math.round(s.returPenjualan) !== 0)
      revenue.push({ kode: "—", nama: "Retur Penjualan", nilai: -Math.round(s.returPenjualan) });
    const cos = barisAktual(s.hpp.baris);
    if (Math.round(s.diskonPembelian) !== 0)
      cos.push({ kode: "—", nama: "Diskon Pembelian", nilai: -Math.round(s.diskonPembelian) });
    aktualPerBulan.push({
      revenue,
      cos,
      opex: barisAktual(s.biayaOperasional.baris),
      otherIncome: barisAktual(s.pendapatanLainnya.baris),
      otherExpense: barisAktual(s.biayaLainnya.baris),
      labaKotor: Math.round(s.labaKotor),
      operasionalBersih: Math.round(s.operasionalBersih),
      labaBersih: Math.round(s.labaBersih),
      totalBiayaOperasional: Math.round(s.totalBiayaOperasional),
      totalPendapatanLainnya: Math.round(s.totalPendapatanLainnya),
      totalBiayaLainnya: Math.round(s.totalBiayaLainnya),
    });
  }

  const urutAkun = (a: { kode: string; nama: string }, b: { kode: string; nama: string }) => {
    if (a.kode === "—" && b.kode !== "—") return 1;
    if (b.kode === "—" && a.kode !== "—") return -1;
    return a.kode.localeCompare(b.kode) || a.nama.localeCompare(b.nama);
  };

  const susun = (key: AnggaranSectionKey, ambilAktual: (m: AktualBulan) => AktualBaris[]): AnggaranSection => {
    const KelompokBudget: Record<BudgetSectionKey, boolean> = {
      revenue: key === "revenue",
      otherIncome: key === "otherIncome",
      opex: key === "opex",
      otherExpense: key === "otherExpense",
    };
    // Union akun budget (klasifikasi section) + akun realisasi (nilai tak nol).
    const akunMap = new Map<string, { kode: string; nama: string }>();
    if (key !== "cos") {
      for (const [kode, arr] of nilai.entries()) {
        if (!KelompokBudget[sectionBudgetOf(kode, coa)]) continue;
        if (!arr.some((v) => v !== 0)) continue;
        akunMap.set(`${kode}|${coa.get(kode)?.nama ?? `Akun ${kode}`}`, {
          kode,
          nama: coa.get(kode)?.nama ?? `Akun ${kode}`,
        });
      }
    }
    for (const m of aktualPerBulan) {
      for (const r of ambilAktual(m)) {
        if (r.nilai === 0) continue;
        akunMap.set(`${r.kode}|${r.nama}`, { kode: r.kode, nama: r.nama });
      }
    }
    const daftar: AnggaranAkunNilai[] = [...akunMap.values()].sort(urutAkun).map(({ kode, nama }) => {
      const arr = nilai.get(kode) ?? bulan.map(() => 0);
      const real = bulan.map((_, i) =>
        ambilAktual(aktualPerBulan[i])
          .filter((r) => r.kode === kode && (kode !== "—" || r.nama === nama))
          .reduce((s, r) => s + r.nilai, 0)
      );
      const sel = real.map((v, i) => v - arr[i]);
      const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
      return {
        kode, nama,
        bulan: arr, total: sum(arr),
        realisasi: real, realisasiTotal: sum(real),
        selisih: sel, selisihTotal: sum(sel),
      };
    });
    const sumCol = (f: (a: AnggaranAkunNilai) => number[]) =>
      bulan.map((_, i) => daftar.reduce((s, a) => s + f(a)[i], 0));
    const sumTot = (f: (a: AnggaranAkunNilai) => number) => daftar.reduce((s, a) => s + f(a), 0);
    const totalBulan = sumCol((a) => a.bulan);
    const realisasiBulan = sumCol((a) => a.realisasi);
    const selisihBulan = sumCol((a) => a.selisih);
    return {
      key, judul: JUDUL[key], akun: daftar,
      totalBulan, total: sumTot((a) => a.total),
      realisasiBulan, realisasiTotal: sumTot((a) => a.realisasiTotal),
      selisihBulan, selisihTotal: sumTot((a) => a.selisihTotal),
    };
  };

  const revenue = susun("revenue", (m) => m.revenue);
  const cos = susun("cos", (m) => m.cos);
  const opex = susun("opex", (m) => m.opex);
  const otherIncome = susun("otherIncome", (m) => m.otherIncome);
  const otherExpense = susun("otherExpense", (m) => m.otherExpense);

  const kurang = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
  const tambah = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const baris = (judul: string, arr: number[], real: number[]): AnggaranBarisTotal => {
    const sel = real.map((v, i) => v - arr[i]);
    return {
      judul, bulan: arr, total: sum(arr),
      realisasi: real, realisasiTotal: sum(real),
      selisih: sel, selisihTotal: sum(sel),
    };
  };

  const col = (f: (m: AktualBulan) => number) => bulan.map((_, i) => f(aktualPerBulan[i]));
  const grossBulan = kurang(revenue.totalBulan, cos.totalBulan);
  const operatingBulan = kurang(grossBulan, opex.totalBulan);
  const otherBulan = kurang(otherIncome.totalBulan, otherExpense.totalBulan);
  const profitBulan = tambah(operatingBulan, otherBulan);

  return {
    id: anggaran.id,
    nama: anggaran.nama,
    label: `${bulan[0].label} – ${bulan[bulan.length - 1].label}`,
    bulan: bulan.map((b) => ({ ...b, label: labelPendek(b.tahun, b.bulan) })),
    revenue,
    cos,
    grossProfit: baris("Gross Profit", grossBulan, col((m) => m.labaKotor)),
    opex,
    opexTotal: baris("Total dari Operational Expense", opex.totalBulan, col((m) => m.totalBiayaOperasional)),
    operatingProfit: baris("Operating Profit", operatingBulan, col((m) => m.operasionalBersih)),
    otherIncome,
    otherExpense,
    otherTotal: baris(
      "Total dari Other Income (Expense)",
      otherBulan,
      col((m) => m.totalPendapatanLainnya - m.totalBiayaLainnya)
    ),
    profit: baris("Profit (Loss)", profitBulan, col((m) => m.labaBersih)),
    dibuatOleh: anggaran.createdBy?.nama ?? null,
    diubahPada: anggaran.updatedAt.toISOString(),
    catatan: [
      `Nilai dari ${anggaran.items.length} item anggaran tersimpan "${anggaran.nama}" (data asli, tanpa dummy).`,
      "Klasifikasi akun: Pendapatan Usaha → Revenue; Pendapatan lainnya → Other Income; Beban selain Pelunasan Hutang → Operational Expense; Pelunasan Hutang (5501) → Other Expense.",
      "Cost of Sales bernilai Rp 0 karena Harga Pokok Penjualan dihitung dari mutasi persediaan dan tidak memiliki pasangan akun budget.",
      "Realisasi memakai snapshot Laba Rugi resmi per bulan (sumber yang sama dengan laporan Laba Rugi); Selisih = Realisasi − Anggaran.",
      ...(diLuarPeriode > 0 ? [`${diLuarPeriode} item di luar periode diabaikan.`] : []),
    ],
  };
}
