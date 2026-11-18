import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { getSaldoPerSumber } from "@/lib/keuangan-server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { z } from "zod";
import { getLabaRugi } from "@/lib/laba-rugi-common";

// Dashboard Keuangan PT BST — READ ONLY, merangkum data yang sudah ada.
// Tiap section punya filter periodenya sendiri (query param), tidak saling memengaruhi.
// Tidak membuat transaksi baru. Angka konsisten dengan Kas & Bank, Penjualan,
// Hutang & Piutang, dan COA karena memakai sumber yang sama.

const sectionSchema = z.enum([
  "arus-kas",
  "penjualan-terhutang",
  "tagihan-belum-dibayar",
  "laba-rugi",
  "biaya-operasional",
  "akun-terpantau",
  "produk-terlaris",
  "piutang-usaha",
  "kas",
]);

const periodeSchema = z.enum([
  "hari-ini",
  "pekan-ini",
  "bulan-ini",
  "kuartal-ini",
  "tahun-ini",
  "kemarin",
  "pekan-lalu",
  "bulan-lalu",
  "kuartal-lalu",
  "tahun-lalu",
  "harian",
  "bulanan",
  "custom",
]);

type Bucket = { start: Date; end: Date; label: string };

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
function monthLabel(d: Date) {
  return d.toLocaleDateString("id-ID", { month: "short" });
}
function dayLabel(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

// Rentang + bucket zina per periode. Semua berbasis tanggal kalender lokal.
function resolveRange(
  periode: z.infer<typeof periodeSchema>,
  dari?: string,
  sampai?: string
): { start: Date; end: Date; buckets: Bucket[] } {
  const now = new Date();
  const today = startOfDay(now);

  const dailyBuckets = (s: Date, e: Date): Bucket[] => {
    const out: Bucket[] = [];
    for (let d = new Date(s); d <= e; d = addDays(d, 1)) {
      out.push({ start: startOfDay(d), end: endOfDay(d), label: dayLabel(d) });
    }
    return out;
  };
  const monthlyBuckets = (s: Date, count: number): Bucket[] => {
    const out: Bucket[] = [];
    for (let i = 0; i < count; i++) {
      const m = new Date(s.getFullYear(), s.getMonth() + i, 1);
      const e = new Date(m.getFullYear(), m.getMonth() + 1, 0);
      e.setHours(23, 59, 59, 999);
      out.push({ start: m, end: e, label: monthLabel(m) });
    }
    return out;
  };
  const hourlyBuckets = (day: Date): Bucket[] => {
    const out: Bucket[] = [];
    for (let h = 0; h < 24; h += 3) {
      const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h);
      const e = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h + 2, 59, 59, 999);
      out.push({ start: s, end: e, label: `${String(h).padStart(2, "0")}.00` });
    }
    return out;
  };

  switch (periode) {
    case "hari-ini":
      return { start: today, end: endOfDay(now), buckets: hourlyBuckets(today) };
    case "kemarin": {
      const y = addDays(today, -1);
      return { start: y, end: endOfDay(y), buckets: hourlyBuckets(y) };
    }
    case "pekan-ini": {
      const dow = (today.getDay() + 6) % 7; // Senin = 0
      const s = addDays(today, -dow);
      const e = endOfDay(addDays(s, 6));
      return { start: s, end: e, buckets: dailyBuckets(s, addDays(s, 6)) };
    }
    case "pekan-lalu": {
      const dow = (today.getDay() + 6) % 7;
      const s = addDays(today, -dow - 7);
      const e = endOfDay(addDays(s, 6));
      return { start: s, end: e, buckets: dailyBuckets(s, addDays(s, 6)) };
    }
    case "bulan-ini": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: s, end: endOfDay(last), buckets: dailyBuckets(s, last) };
    }
    case "bulan-lalu": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: s, end: endOfDay(last), buckets: dailyBuckets(s, last) };
    }
    case "kuartal-ini": {
      const q = Math.floor(now.getMonth() / 3);
      const s = new Date(now.getFullYear(), q * 3, 1);
      return { start: s, end: endOfDay(new Date(s.getFullYear(), s.getMonth() + 3, 0)), buckets: monthlyBuckets(s, 3) };
    }
    case "kuartal-lalu": {
      const q = Math.floor(now.getMonth() / 3) - 1;
      const s = new Date(now.getFullYear(), q * 3, 1);
      return { start: s, end: endOfDay(new Date(s.getFullYear(), s.getMonth() + 3, 0)), buckets: monthlyBuckets(s, 3) };
    }
    case "tahun-ini": {
      const s = new Date(now.getFullYear(), 0, 1);
      return { start: s, end: endOfDay(new Date(now.getFullYear(), 11, 31)), buckets: monthlyBuckets(s, 12) };
    }
    case "tahun-lalu": {
      const s = new Date(now.getFullYear() - 1, 0, 1);
      return { start: s, end: endOfDay(new Date(now.getFullYear() - 1, 11, 31)), buckets: monthlyBuckets(s, 12) };
    }
    case "harian": {
      const s = addDays(today, -29);
      return { start: s, end: endOfDay(now), buckets: dailyBuckets(s, today) };
    }
    case "bulanan": {
      const s = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      return { start: s, end: endOfDay(now), buckets: monthlyBuckets(s, 12) };
    }
    case "custom": {
      const s = dari ? startOfDay(new Date(dari)) : today;
      const e = sampai ? endOfDay(new Date(sampai)) : endOfDay(s);
      const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
      if (days <= 0 || days > 372) throw new Error("Rentang custom maksimal 372 hari");
      const buckets = days <= 62 ? dailyBuckets(s, new Date(e)) : monthlyBuckets(new Date(s.getFullYear(), s.getMonth(), 1), Math.min(12, Math.ceil(days / 30)));
      return { start: s, end: e, buckets };
    }
  }
}

// Ringkasan kas (masuk/keluar/bersih) + per bucket dalam rentang.
// TRANSFER dikecualikan (perpindahan internal), konsisten dengan modul Kas & Bank.
// Set excludeModal31 agar tidak memperhitungkan setoran/penarikan modal 31xx
// sebagai pendapatan atau beban (masuk Perubahan Modal, bukan Laba Rugi).
async function arusKas(start: Date, end: Date, buckets: Bucket[], excludeModal31 = false) {
  const rows = await prisma.transaksiKas.findMany({
    where: {
      tanggal: { gte: start, lte: end },
      tipe: { in: ["PEMASUKAN", "PENGELUARAN"] },
      ...(excludeModal31 ? { kodeAkun: { not: { startsWith: "31" } } } : {}),
    },
    select: { tipe: true, jumlah: true, tanggal: true },
  });
  let masuk = 0;
  let keluar = 0;
  const items = buckets.map((b) => {
    let m = 0;
    let k = 0;
    for (const r of rows) {
      if (r.tanggal >= b.start && r.tanggal <= b.end) {
        const v = Number(r.jumlah);
        if (r.tipe === "PEMASUKAN") m += v;
        else k += v;
      }
    }
    masuk += m;
    keluar += k;
    return { label: b.label, masuk: m, keluar: k, bersih: m - k };
  });
  return { totalMasuk: masuk, totalKeluar: keluar, bersih: masuk - keluar, items };
}

// Laba rugi basis akrual menggunakan fungsi bersama getLabaRugi
async function labaRugi(start: Date, end: Date, buckets: Bucket[]) {
  const res = await getLabaRugi(start, end);
  const bebanTotal = res.totalHpp + res.totalBeban;
  const items = await Promise.all(
    buckets.map(async (b) => {
      const r = await getLabaRugi(b.start, b.end);
      return {
        label: b.label,
        pendapatan: r.totalPendapatan,
        beban: r.totalHpp + r.totalBeban,
        laba: r.labaBersih,
      };
    })
  );
  return {
    pendapatan: res.totalPendapatan,
    beban: bebanTotal,
    labaBersih: res.labaBersih,
    items,
    basis: "akrual" as const,
  };
}

// Status terhutang (PIUTANG penjualan / HUTANG) berdasarkan tanggal dokumen dalam rentang.
async function terhutang(tipe: "PIUTANG" | "HUTANG", start: Date, end: Date) {
  const now = startOfDay(new Date());
  const rows = await prisma.tagihan.findMany({
    where: { tipe, tanggal: { gte: start, lte: end } },
    select: { status: true, sisa: true, jumlah: true, jatuhTempo: true },
  });
  let belumCount = 0, belumNominal = 0;
  let telatCount = 0, telatNominal = 0;
  let lunasCount = 0, lunasNominal = 0;
  for (const r of rows) {
    const sisa = Number(r.sisa);
    const jumlah = Number(r.jumlah);
    if (r.status === "LUNAS") { lunasCount++; lunasNominal += jumlah; continue; }
    if (r.jatuhTempo && new Date(r.jatuhTempo) < now) { telatCount++; telatNominal += sisa; }
    else { belumCount++; belumNominal += sisa; }
  }
  return {
    belumDibayar: { count: belumCount, nominal: belumNominal },
    telatDibayar: { count: telatCount, nominal: telatNominal },
    lunas: { count: lunasCount, nominal: lunasNominal },
  };
}

async function biayaOperasional(start: Date, end: Date) {
  const { bebanDetails } = await getLabaRugi(start, end);
  const items = Array.from(bebanDetails.entries())
    .map(([key, v]) => ({ kategori: v.nama, nominal: v.nilai, count: 1 }))
    .sort((a, b) => b.nominal - a.nominal)
    .slice(0, 10);
  const total = items.reduce((s, i) => s + i.nominal, 0);
  return {
    total,
    items,
  };
}

// Akun terpantau: Kas/Bank/Tabungan = saldo transfer-aware dalam rentang
// (rumus yang sama dengan halaman Kas & Bank: masuk - keluar - transfer
// keluar + transfer masuk); Piutang/Utang = sisa berjalan.
async function akunTerpantau() {
  const now = new Date();
  const awalBulan = new Date(now.getFullYear(), now.getMonth(), 1);
  const awalTahun = new Date(now.getFullYear(), 0, 1);
  const akhir = endOfDay(now);

  const [saldoBulan, saldoTahun, piutangBulan, piutangTahun, hutangBulan, hutangTahun, akunDb] = await Promise.all([
    getSaldoPerSumber({ gte: awalBulan, lte: akhir }),
    getSaldoPerSumber({ gte: awalTahun, lte: akhir }),
    prisma.tagihan.aggregate({
      where: { tipe: "PIUTANG", status: { not: "LUNAS" }, tanggal: { gte: awalBulan, lte: akhir } },
      _sum: { sisa: true }, _count: { id: true },
    }),
    prisma.tagihan.aggregate({
      where: { tipe: "PIUTANG", status: { not: "LUNAS" }, tanggal: { gte: awalTahun, lte: akhir } },
      _sum: { sisa: true }, _count: { id: true },
    }),
    prisma.tagihan.aggregate({
      where: { tipe: "HUTANG", status: { not: "LUNAS" }, tanggal: { gte: awalBulan, lte: akhir } },
      _sum: { sisa: true }, _count: { id: true },
    }),
    prisma.tagihan.aggregate({
      where: { tipe: "HUTANG", status: { not: "LUNAS" }, tanggal: { gte: awalTahun, lte: akhir } },
      _sum: { sisa: true }, _count: { id: true },
    }),
    prisma.akunCOA.findMany({
      where: { kode: { in: ["1101", "1102", "1103", "1104", "2101"] }, isActive: true },
      select: { kode: true, nama: true },
    }),
  ]);

  const nama = (kode: string, fallback: string) => akunDb.find((a) => a.kode === kode)?.nama ?? fallback;

  return {
    akun: [
      { kode: "1101", nama: nama("1101", "Kas"), bulanIni: saldoBulan.KAS, tahunIni: saldoTahun.KAS },
      { kode: "1103", nama: nama("1103", "Bank"), bulanIni: saldoBulan.BANK, tahunIni: saldoTahun.BANK },
      { kode: "1104", nama: nama("1104", "Tabungan"), bulanIni: saldoBulan.TABUNGAN, tahunIni: saldoTahun.TABUNGAN },
      { kode: "1102", nama: nama("1102", "Piutang"), bulanIni: Number(piutangBulan._sum.sisa ?? 0), tahunIni: Number(piutangTahun._sum.sisa ?? 0), countBulan: piutangBulan._count.id, countTahun: piutangTahun._count.id },
      { kode: "2101", nama: nama("2101", "Utang Usaha"), bulanIni: Number(hutangBulan._sum.sisa ?? 0), tahunIni: Number(hutangTahun._sum.sisa ?? 0), countBulan: hutangBulan._count.id, countTahun: hutangBulan._count.id },
    ],
  };
}

// Produk terlaris dari item Penagihan nyata (bukan dummy).
async function produkTerlaris(start: Date, end: Date) {
  const items = await prisma.dokumenPenjualanItem.findMany({
    where: { dokumen: { tipe: "PENAGIHAN", tanggal: { gte: start, lte: end } } },
    select: { deskripsi: true, kuantitas: true, unit: true, jumlah: true },
  });
  const map = new Map<string, { deskripsi: string; unit: string; qty: number; nilai: number; transaksi: number }>();
  for (const it of items) {
    const key = it.deskripsi.trim().toLowerCase();
    const cur = map.get(key) ?? { deskripsi: it.deskripsi.trim(), unit: it.unit, qty: 0, nilai: 0, transaksi: 0 };
    cur.qty += Number(it.kuantitas);
    cur.nilai += Number(it.jumlah);
    cur.transaksi += 1;
    map.set(key, cur);
  }
  return { items: [...map.values()].sort((a, b) => b.nilai - a.nilai).slice(0, 10) };
}

// Piutang usaha: saldo berjalan + terbentuk vs terlunasi per bucket (data nyata).
async function piutangUsaha(buckets: Bucket[], start: Date) {
  const formedBefore = await prisma.tagihan.aggregate({
    where: { tipe: "PIUTANG", tanggal: { lt: start } },
    _sum: { jumlah: true },
  });
  const paidBeforeRows = await prisma.transaksiKas.findMany({
    where: { tanggal: { lt: start }, tagihan: { tipe: "PIUTANG" } },
    select: { jumlah: true },
  });
  let berjalan = Number(formedBefore._sum.jumlah ?? 0) - paidBeforeRows.reduce((s, r) => s + Number(r.jumlah), 0);

  const formed = await prisma.tagihan.findMany({
    where: { tipe: "PIUTANG", tanggal: { gte: buckets[0].start, lte: buckets[buckets.length - 1].end } },
    select: { jumlah: true, tanggal: true },
  });
  const paid = await prisma.transaksiKas.findMany({
    where: { tanggal: { gte: buckets[0].start, lte: buckets[buckets.length - 1].end }, tagihan: { tipe: "PIUTANG" } },
    select: { jumlah: true, tanggal: true },
  });

  const items = buckets.map((b) => {
    let f = 0, p = 0;
    for (const r of formed) if (r.tanggal >= b.start && r.tanggal <= b.end) f += Number(r.jumlah);
    for (const r of paid) if (r.tanggal >= b.start && r.tanggal <= b.end) p += Number(r.jumlah);
    berjalan += f - p;
    return { label: b.label, terbentuk: f, terlunasi: p, saldo: Math.max(0, berjalan) };
  });

  const saldoKini = await prisma.tagihan.aggregate({
    where: { tipe: "PIUTANG", status: { not: "LUNAS" } },
    _sum: { sisa: true }, _count: { id: true },
  });
  return {
    saldo: Number(saldoKini._sum.sisa ?? 0),
    count: saldoKini._count.id,
    items,
  };
}

// Kas: saldo Bank, saldo Jurnal (seluruh sumber), grafik saldo berjalan kumulatif.
// Saldo memakai rumus transfer-aware yang sama dengan halaman Kas & Bank.
async function kasSection(buckets: Bucket[], start: Date) {
  const [saldoSemua, beforeRows] = await Promise.all([
    getSaldoPerSumber(),
    prisma.transaksiKas.findMany({
      where: { tanggal: { lt: start }, tipe: { in: ["PEMASUKAN", "PENGELUARAN"] } },
      select: { tipe: true, jumlah: true, tanggal: true },
    }),
  ]);
  const saldoBank = saldoSemua.BANK;
  const saldoJurnal = saldoSemua.KAS + saldoSemua.BANK + saldoSemua.TABUNGAN;

  let berjalan = 0;
  for (const r of beforeRows) berjalan += (r.tipe === "PEMASUKAN" ? 1 : -1) * Number(r.jumlah);
  const inRange = await prisma.transaksiKas.findMany({
    where: { tanggal: { gte: buckets[0].start, lte: buckets[buckets.length - 1].end }, tipe: { in: ["PEMASUKAN", "PENGELUARAN"] } },
    select: { tipe: true, jumlah: true, tanggal: true },
  });
  const items = buckets.map((b) => {
    let d = 0;
    for (const r of inRange) if (r.tanggal >= b.start && r.tanggal <= b.end) d += (r.tipe === "PEMASUKAN" ? 1 : -1) * Number(r.jumlah);
    berjalan += d;
    return { label: b.label, saldo: berjalan };
  });

  return {
    saldoBank,
    saldoJurnal,
    rekonsiliasi: { perlu: 0, didukung: false },
    items,
  };
}

// GET /api/keuangan/dashboard?section=arus-kas&periode=bulan-ini[&dari=&sampai=]
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const section = sectionSchema.parse(searchParams.get("section") ?? "arus-kas");
    const periode = periodeSchema.parse(searchParams.get("periode") ?? "bulan-ini");
    const { start, end, buckets } = resolveRange(
      periode,
      searchParams.get("dari") || undefined,
      searchParams.get("sampai") || undefined
    );

    switch (section) {
      case "arus-kas":
        return successResponse({ ...(await arusKas(start, end, buckets)), periode });
      case "penjualan-terhutang":
        return successResponse({ ...(await terhutang("PIUTANG", start, end)), periode });
      case "tagihan-belum-dibayar":
        return successResponse({ ...(await terhutang("HUTANG", start, end)), periode });
      case "laba-rugi":
        return successResponse({ ...(await labaRugi(start, end, buckets)), periode });
      case "biaya-operasional":
        return successResponse({ ...(await biayaOperasional(start, end)), periode });
      case "akun-terpantau":
        return successResponse({ ...(await akunTerpantau()), periode });
      case "produk-terlaris":
        return successResponse({ ...(await produkTerlaris(start, end)), periode });
      case "piutang-usaha":
        return successResponse({ ...(await piutangUsaha(buckets, start)), periode });
      case "kas":
        return successResponse({ ...(await kasSection(buckets, start)), periode });
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return errorResponse("Filter tidak valid", 400);
    }
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil ringkasan dashboard", 400);
  }
}
