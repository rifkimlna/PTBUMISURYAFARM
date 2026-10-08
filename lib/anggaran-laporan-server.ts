// Service Laporan Anggaran (detail per anggaran) PT Bumi Surya Farm.
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Data 100% asli dari AnggaranItem + master AkunCOA, tanpa dummy:
// - Periode = periode tersimpan (tahunMulai/bulanMulai/durasi).
// - Klasifikasi section memakai sectionBudgetOf yang sama dengan monitor
//   (Pendapatan Usaha → Revenue; Pendapatan lain → Other Income;
//   Beban non-Pelunasan Hutang → Operational Expense; 5501 → Other Expense).
// - Harga Pokok Penjualan dihitung dari mutasi persediaan sehingga tidak
//   memiliki pasangan akun budget (bagian Cost of Sales bernilai Rp 0).

import { prisma } from "@/lib/prisma";
import { sectionBudgetOf, type BudgetSectionKey, type CoaInfo } from "@/lib/anggaran-monitor-server";
import type { MonitorBulan } from "@/lib/anggaran-monitor-types";

export type AnggaranSectionKey = "revenue" | "cos" | "opex" | "otherIncome" | "otherExpense";

export type AnggaranAkunNilai = {
  kode: string;
  nama: string;
  /** Nominal per bulan periode anggaran. */
  bulan: number[];
  total: number;
};

export type AnggaranSection = {
  key: AnggaranSectionKey;
  judul: string;
  akun: AnggaranAkunNilai[];
  totalBulan: number[];
  total: number;
};

export type AnggaranDetailSnapshot = {
  id: string;
  nama: string;
  /** ex: "April 2026 – Juni 2026". */
  label: string;
  bulan: MonitorBulan[];
  revenue: AnggaranSection;
  cos: AnggaranSection;
  grossProfit: { judul: string; bulan: number[]; total: number };
  opex: AnggaranSection;
  opexTotal: { judul: string; bulan: number[]; total: number };
  operatingProfit: { judul: string; bulan: number[]; total: number };
  otherIncome: AnggaranSection;
  otherExpense: AnggaranSection;
  otherTotal: { judul: string; bulan: number[]; total: number };
  profit: { judul: string; bulan: number[]; total: number };
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

  const susun = (key: AnggaranSectionKey): AnggaranSection => {
    const KelompokBudget: Record<BudgetSectionKey, boolean> = {
      revenue: key === "revenue",
      otherIncome: key === "otherIncome",
      opex: key === "opex",
      otherExpense: key === "otherExpense",
    };
    const daftar = [...nilai.entries()]
      .filter(([kode]) => (key === "cos" ? false : KelompokBudget[sectionBudgetOf(kode, coa)]))
      .map(([kode, arr]) => ({
        kode,
        nama: coa.get(kode)?.nama ?? `Akun ${kode}`,
        bulan: arr,
        total: arr.reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => a.kode.localeCompare(b.kode));
    const totalBulan = bulan.map((_, i) => daftar.reduce((s, a) => s + a.bulan[i], 0));
    return { key, judul: JUDUL[key], akun: daftar, totalBulan, total: totalBulan.reduce((s, v) => s + v, 0) };
  };

  const revenue = susun("revenue");
  const cos = susun("cos");
  const opex = susun("opex");
  const otherIncome = susun("otherIncome");
  const otherExpense = susun("otherExpense");

  const kurang = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
  const tambah = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const baris = (judul: string, arr: number[]) => ({ judul, bulan: arr, total: sum(arr) });

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
    grossProfit: baris("Gross Profit", grossBulan),
    opex,
    opexTotal: baris("Total dari Operational Expense", opex.totalBulan),
    operatingProfit: baris("Operating Profit", operatingBulan),
    otherIncome,
    otherExpense,
    otherTotal: baris("Total dari Other Income (Expense)", otherBulan),
    profit: baris("Profit (Loss)", profitBulan),
    dibuatOleh: anggaran.createdBy?.nama ?? null,
    diubahPada: anggaran.updatedAt.toISOString(),
    catatan: [
      `Nilai dari ${anggaran.items.length} item anggaran tersimpan "${anggaran.nama}" (data asli, tanpa dummy).`,
      "Klasifikasi akun: Pendapatan Usaha → Revenue; Pendapatan lainnya → Other Income; Beban selain Pelunasan Hutang → Operational Expense; Pelunasan Hutang (5501) → Other Expense.",
      "Cost of Sales bernilai Rp 0 karena Harga Pokok Penjualan dihitung dari mutasi persediaan dan tidak memiliki pasangan akun budget.",
      ...(diLuarPeriode > 0 ? [`${diLuarPeriode} item di luar periode diabaikan.`] : []),
    ],
  };
}
