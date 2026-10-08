// Service Monitor Anggaran Laba Rugi PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Data 100% asli, tanpa dummy:
// - Anggaran: AnggaranItem milik SATU anggaran terpilih (kodeAkun x bulan),
//   diklasifikasi ke section via master AkunCOA (kelompok + golongan).
// - Aktual: getLabaRugiSnapshot per bulan (angka resmi yang sama dengan
//   Laporan Laba Rugi) — baris akun + baris penyesuaian (diskon/retur).
//
// Aturan klasifikasi akun budget (didokumentasikan juga di catatan laporan):
// - Pendapatan + golongan "Pendapatan Usaha" -> Revenue.
// - Pendapatan + golongan lain -> Other Income.
// - Beban + golongan "Pelunasan Hutang" -> Other Expense.
// - Beban + golongan lain -> Operational Expense.
// - Harga Pokok Penjualan dihitung dari mutasi persediaan sehingga tidak
//   memiliki pasangan akun budget (anggaran Rp 0).

import { prisma } from "@/lib/prisma";
import { getLabaRugiSnapshot } from "@/lib/laba-rugi-server";
import type {
  MonitorAkunNilai,
  MonitorBulan,
  MonitorKolom,
  MonitorLihatBalik,
  MonitorSection,
  MonitorSnapshot,
  MonitorTampilSetiap,
} from "@/lib/anggaran-monitor-types";

export {
  MONITOR_LIHAT_BALIK,
  MONITOR_TAMPIL_SETIAP,
  MONITOR_TEMPLATE,
  MONITOR_TEMPLATE_LABEL,
} from "@/lib/anggaran-monitor-types";
export type {
  MonitorAkunNilai,
  MonitorBulan,
  MonitorKolom,
  MonitorLihatBalik,
  MonitorSection,
  MonitorSnapshot,
  MonitorTampilSetiap,
} from "@/lib/anggaran-monitor-types";

export type MonitorFilter = {
  anggaranId: string;
  berakhirPada: { tahun: number; bulan: number };
  lihatBalik: MonitorLihatBalik;
  tampilSetiap: MonitorTampilSetiap;
};

type SectionKey = MonitorSection["key"];

const SECTION_JUDUL: Record<SectionKey, string> = {
  revenue: "Revenue",
  cos: "Cost of Sales",
  opex: "Operational Expense",
  otherIncome: "Other Income",
  otherExpense: "Other Expense",
};

function labelBulanPanjang(tahun: number, bulan: number) {
  return new Date(tahun, bulan - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function labelBulanPendek(tahun: number, bulan: number) {
  return new Date(tahun, bulan - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}

function endOfDay(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Window bulan: berakhirPada inklusif, mundur (lihatBalik - 1) bulan. */
export function bulanWindow(berakhirPada: { tahun: number; bulan: number }, lihatBalik: number): MonitorBulan[] {
  const out: MonitorBulan[] = [];
  let t = berakhirPada.tahun;
  let m = berakhirPada.bulan - (lihatBalik - 1);
  while (m < 1) {
    m += 12;
    t -= 1;
  }
  for (let i = 0; i < lihatBalik; i++) {
    const idx = m - 1 + i;
    const tahun = t + Math.floor(idx / 12);
    const bulan = (idx % 12) + 1;
    out.push({ tahun, bulan, label: labelBulanPanjang(tahun, bulan) });
  }
  return out;
}

/** Kelompokkan bulan menjadi kolom agregasi (tampilSetiap bulan per kolom). */
export function kolomDariBulan(semua: MonitorBulan[], tampilSetiap: number): MonitorKolom[] {
  const out: MonitorKolom[] = [];
  for (let i = 0; i < semua.length; i += tampilSetiap) {
    const grup = semua.slice(i, i + tampilSetiap);
    const label =
      grup.length === 1
        ? labelBulanPendek(grup[0].tahun, grup[0].bulan)
        : `${labelBulanPendek(grup[0].tahun, grup[0].bulan)} – ${labelBulanPendek(
            grup[grup.length - 1].tahun,
            grup[grup.length - 1].bulan
          )}`;
    out.push({ label, bulan: grup });
  }
  return out;
}

type CoaInfo = { nama: string; kelompok: string; golongan: string };

export type BudgetSectionKey = "revenue" | "otherIncome" | "opex" | "otherExpense";

/** Klasifikasi akun budget ke section (dipakai monitor & laporan anggaran). */
export function sectionBudgetOf(kode: string, coa: Map<string, CoaInfo>): BudgetSectionKey {
  const a = coa.get(kode);
  if (!a) return "opex";
  if (a.kelompok === "Pendapatan") return a.golongan === "Pendapatan Usaha" ? "revenue" : "otherIncome";
  if (a.kelompok === "Beban") return a.golongan === "Pelunasan Hutang" ? "otherExpense" : "opex";
  return "opex";
}

export type { CoaInfo };

type NilaiAktual = { kode: string; nama: string; nilai: number };

export async function getAnggaranMonitorSnapshot(f: MonitorFilter): Promise<MonitorSnapshot> {
  const anggaran = await prisma.anggaranLabaRugi.findUnique({
    where: { id: f.anggaranId },
    include: { items: { select: { kodeAkun: true, tahun: true, bulan: true, nominal: true } } },
  });
  if (!anggaran) throw new Error("Anggaran tidak ditemukan");

  const akunDb = await prisma.akunCOA.findMany({
    where: { isActive: true },
    select: { kode: true, nama: true, kelompok: true, golongan: true },
  });
  const coa = new Map<string, CoaInfo>(akunDb.map((a) => [a.kode, { nama: a.nama, kelompok: a.kelompok, golongan: a.golongan }]));

  const window = bulanWindow(f.berakhirPada, f.lihatBalik);
  const kolom = kolomDariBulan(window, f.tampilSetiap);

  // Budget lookup: `${kode}|${tahun}-${bulan}` -> nominal (data asli anggaran terpilih).
  const budget = new Map<string, number>();
  for (const it of anggaran.items) {
    const k = `${it.kodeAkun}|${it.tahun}-${it.bulan}`;
    budget.set(k, (budget.get(k) ?? 0) + Math.round(Number(it.nominal) || 0));
  }
  const budgetBulan = (kode: string, tahun: number, bulan: number) => budget.get(`${kode}|${tahun}-${bulan}`) ?? 0;

  // Aktual per bulan memakai snapshot laba rugi resmi (sekuensial seperti getLabaRugiBulanan).
  type AktualBulan = {
    revenue: NilaiAktual[];
    cos: NilaiAktual[];
    opex: NilaiAktual[];
    otherIncome: NilaiAktual[];
    otherExpense: NilaiAktual[];
  };
  const aktualPerBulan: AktualBulan[] = [];
  for (const b of window) {
    const start = new Date(b.tahun, b.bulan - 1, 1);
    const end = endOfDay(new Date(b.tahun, b.bulan, 0));
    const s = await getLabaRugiSnapshot(start, end, "custom", b.label);
    const baris = (rows: { kode: string; nama: string; nilai: number }[]): NilaiAktual[] =>
      rows.map((r) => ({ kode: r.kode, nama: r.nama, nilai: Math.round(Number(r.nilai) || 0) }));
    const revenue = baris(s.penjualan.baris);
    if (Math.round(s.diskonPenjualan) !== 0)
      revenue.push({ kode: "—", nama: "Diskon Penjualan", nilai: -Math.round(s.diskonPenjualan) });
    if (Math.round(s.returPenjualan) !== 0)
      revenue.push({ kode: "—", nama: "Retur Penjualan", nilai: -Math.round(s.returPenjualan) });
    const cos = baris(s.hpp.baris);
    if (Math.round(s.diskonPembelian) !== 0)
      cos.push({ kode: "—", nama: "Diskon Pembelian", nilai: -Math.round(s.diskonPembelian) });
    aktualPerBulan.push({
      revenue,
      cos,
      opex: baris(s.biayaOperasional.baris),
      otherIncome: baris(s.pendapatanLainnya.baris),
      otherExpense: baris(s.biayaLainnya.baris),
    });
  }

  const monthIndex = new Map(window.map((b, i) => [`${b.tahun}-${b.bulan}`, i]));

  const urutAkun = (a: { kode: string; nama: string }, b: { kode: string; nama: string }) => {
    if (a.kode === "—" && b.kode !== "—") return 1;
    if (b.kode === "—" && a.kode !== "—") return -1;
    return a.kode.localeCompare(b.kode) || a.nama.localeCompare(b.nama);
  };

  const susunSection = (key: SectionKey, ambilAktual: (m: AktualBulan) => NilaiAktual[]): MonitorSection => {
    // Kumpulan akun = union akun budget (klasifikasi section) + akun aktual.
    const akunMap = new Map<string, { kode: string; nama: string }>();
    for (const [k, v] of budget) {
      const [kode] = k.split("|");
      if (sectionBudgetOf(kode, coa) !== key) continue;
      if (v === 0) continue;
      const nama = coa.get(kode)?.nama ?? `Akun ${kode}`;
      akunMap.set(`${kode}|${nama}`, { kode, nama });
    }
    for (const m of aktualPerBulan) {
      for (const r of ambilAktual(m)) {
        if (r.nilai === 0) continue;
        akunMap.set(`${r.kode}|${r.nama}`, { kode: r.kode, nama: r.nama });
      }
    }
    const daftar = [...akunMap.values()].sort(urutAkun);

    const akun: MonitorAkunNilai[] = daftar.map(({ kode, nama }) => {
      const anggaranArr = kolom.map((k) =>
        k.bulan.reduce((s, b) => {
          if (kode === "—") return s; // baris penyesuaian tidak punya budget
          return s + budgetBulan(kode, b.tahun, b.bulan);
        }, 0)
      );
      const aktualArr = kolom.map((k) => {
        let total = 0;
        for (const b of k.bulan) {
          const i = monthIndex.get(`${b.tahun}-${b.bulan}`)!;
          const row = ambilAktual(aktualPerBulan[i]).find((r) => r.kode === kode && r.nama === nama);
          if (row) total += row.nilai;
        }
        return total;
      });
      return { kode, nama, anggaran: anggaranArr, aktual: aktualArr };
    });

    const sum = (arr: MonitorAkunNilai[], f2: (a: MonitorAkunNilai) => number[]) =>
      kolom.map((_, i) => arr.reduce((s, a) => s + f2(a)[i], 0));

    return {
      key,
      judul: SECTION_JUDUL[key],
      akun,
      totalAnggaran: sum(akun, (a) => a.anggaran),
      totalAktual: sum(akun, (a) => a.aktual),
    };
  };

  const revenue = susunSection("revenue", (m) => m.revenue);
  const cos = susunSection("cos", (m) => m.cos);
  const opex = susunSection("opex", (m) => m.opex);
  const otherIncome = susunSection("otherIncome", (m) => m.otherIncome);
  const otherExpense = susunSection("otherExpense", (m) => m.otherExpense);

  const kurang = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
  const tambah = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);

  const grossProfit = {
    key: "grossProfit",
    judul: "Gross Profit",
    anggaran: kurang(revenue.totalAnggaran, cos.totalAnggaran),
    aktual: kurang(revenue.totalAktual, cos.totalAktual),
  };
  const operatingProfit = {
    key: "operatingProfit",
    judul: "Operating Profit",
    anggaran: kurang(grossProfit.anggaran, opex.totalAnggaran),
    aktual: kurang(grossProfit.aktual, opex.totalAktual),
  };
  const otherTotal = {
    key: "otherTotal",
    judul: "Total dari Other Income (Expense)",
    anggaran: kurang(otherIncome.totalAnggaran, otherExpense.totalAnggaran),
    aktual: kurang(otherIncome.totalAktual, otherExpense.totalAktual),
  };
  const profit = {
    key: "profit",
    judul: "Profit (Loss)",
    anggaran: tambah(operatingProfit.anggaran, otherTotal.anggaran),
    aktual: tambah(operatingProfit.aktual, otherTotal.aktual),
  };

  const sumAll = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
  const label = `${window[0].label} – ${window[window.length - 1].label}`;

  return {
    anggaranId: anggaran.id,
    anggaranNama: anggaran.nama,
    label,
    berakhirPada: `${f.berakhirPada.tahun}-${String(f.berakhirPada.bulan).padStart(2, "0")}`,
    lihatBalik: f.lihatBalik,
    tampilSetiap: f.tampilSetiap,
    kolom,
    revenue,
    cos,
    grossProfit,
    opex,
    operatingProfit,
    otherIncome,
    otherExpense,
    otherTotal,
    profit,
    totalAkhir: {
      revenueAnggaran: sumAll(revenue.totalAnggaran),
      revenueAktual: sumAll(revenue.totalAktual),
      cosAnggaran: sumAll(cos.totalAnggaran),
      cosAktual: sumAll(cos.totalAktual),
      grossAnggaran: sumAll(grossProfit.anggaran),
      grossAktual: sumAll(grossProfit.aktual),
      opexAnggaran: sumAll(opex.totalAnggaran),
      opexAktual: sumAll(opex.totalAktual),
      operatingAnggaran: sumAll(operatingProfit.anggaran),
      operatingAktual: sumAll(operatingProfit.aktual),
      otherAnggaran: sumAll(otherTotal.anggaran),
      otherAktual: sumAll(otherTotal.aktual),
      profitAnggaran: sumAll(profit.anggaran),
      profitAktual: sumAll(profit.aktual),
    },
    catatan: [
      `Anggaran dari "${anggaran.nama}" (data asli tersimpan); bulan di luar cakupan anggaran bernilai Rp 0.`,
      "Aktual memakai angka resmi Laporan Laba Rugi per bulan (penjualan, HPP dari mutasi persediaan, biaya, pendapatan/biaya lainnya).",
      "Klasifikasi akun budget: Pendapatan Usaha → Revenue; Pendapatan lainnya → Other Income; Beban selain Pelunasan Hutang → Operational Expense; Pelunasan Hutang (5501) → Other Expense.",
      "Harga Pokok Penjualan dihitung dari mutasi persediaan sehingga tidak memiliki pasangan akun budget (anggaran Rp 0).",
    ],
  };
}
