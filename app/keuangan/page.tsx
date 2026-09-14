export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Users, Package, Boxes, ArrowRight, TrendingUp, TrendingDown, Building, Banknote } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { KeuanganLineChart } from "@/components/admin/keuangan-line-chart";

export default async function KeuanganDashboard({
  searchParams,
}: {
  searchParams?: Promise<{ periode?: string }>;
}) {
  // Session untuk welcome
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const session = token ? await verifyToken(token) : null;
  const userName = session?.nama ?? "Pengguna";

  // Periode grafik: 3 / 6 / 12 bulan, default 3
  const sp = await searchParams;
  const periode = sp?.periode === "6" ? 6 : sp?.periode === "12" ? 12 : 3;

  // Data utama (rentang dihitung sekali per request)
  const startDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - (periode - 1));
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const [
    transaksiCount,
    aggKas,
    karyawanCount,
    asetCount,
    barangCount,
    recentTransaksi,
    asetTotalValue,
    monthlyTransactions,
    aggSumber,
  ] = await Promise.all([
    prisma.transaksiKas.count(),
    prisma.transaksiKas.groupBy({
      by: ["tipe"],
      _sum: { jumlah: true },
      _count: { id: true },
    }),
    prisma.karyawan.count(),
    prisma.aset.count(),
    prisma.persediaanBarang.count(),
    prisma.transaksiKas.findMany({
      orderBy: { tanggal: "desc" },
      take: 5,
      include: { admin: { select: { nama: true } } },
    }),
    prisma.aset.aggregate({ _sum: { nilaiAset: true } }),
    prisma.transaksiKas.findMany({
      where: { tanggal: { gte: startDate } },
      orderBy: { tanggal: "asc" },
      select: { tipe: true, jumlah: true, tanggal: true },
    }),
    prisma.transaksiKas.groupBy({
      by: ["sumberDana", "tipe"],
      _sum: { jumlah: true },
    }),
  ]);

  const pemasukan = Number(aggKas.find((a) => a.tipe === "PEMASUKAN")?._sum.jumlah ?? 0);
  const pengeluaran = Number(aggKas.find((a) => a.tipe === "PENGELUARAN")?._sum.jumlah ?? 0);
  const pemasukanCount = aggKas.find((a) => a.tipe === "PEMASUKAN")?._count?.id ?? 0;
  const saldo = pemasukan - pengeluaran;
  // Posisi dana per sumber (seluruh waktu, konsisten dengan kartu Saldo)
  const saldoSumber = (sumber: string) =>
    Number(aggSumber.find((a) => a.sumberDana === sumber && a.tipe === "PEMASUKAN")?._sum.jumlah ?? 0) -
    Number(aggSumber.find((a) => a.sumberDana === sumber && a.tipe === "PENGELUARAN")?._sum.jumlah ?? 0);
  const posisiDana = [
    { label: "Kas", nilai: saldoSumber("KAS") },
    { label: "Bank", nilai: saldoSumber("BANK") },
    { label: "Tabungan", nilai: saldoSumber("TABUNGAN") },
  ];

  // Agregasi bulanan untuk line chart (periode dinamis, tren bukan total)
  const monthlyMap = new Map<string, { pemasukan: number; pengeluaran: number }>();
  monthlyTransactions.forEach((t) => {
    const monthKey = t.tanggal.toISOString().slice(0, 7); // YYYY-MM
    const entry = monthlyMap.get(monthKey) ?? { pemasukan: 0, pengeluaran: 0 };
    const jumlah = Number(t.jumlah);
    if (t.tipe === "PEMASUKAN") entry.pemasukan += jumlah;
    else entry.pengeluaran += jumlah;
    monthlyMap.set(monthKey, entry);
  });
  // Pastikan tiap bulan dalam periode terisi (meskipun nol)
  const monthlyData: { label: string; pemasukan: number; pengeluaran: number }[] = [];
  for (let i = periode - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    const entry = monthlyMap.get(key) ?? { pemasukan: 0, pengeluaran: 0 };
    monthlyData.push({
      label: d.toLocaleString("id-ID", { month: "short" }),
      pemasukan: entry.pemasukan,
      pengeluaran: entry.pengeluaran,
    });
  }

  const totalAsetValue = Number(asetTotalValue._sum.nilaiAset ?? 0);

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
            Selamat Datang, {userName} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-400">Pantau kondisi keuangan PT Bumi Surya Farm dalam satu halaman.</p>
        </div>
        <div className="flex items-center justify-center sm:justify-end">
          <Building className="h-12 w-12 text-emerald-700 opacity-30" aria-hidden="true" />
        </div>
      </div>

      {/* 3 Card Utama */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card
          className={`rounded-2xl border border-green-200 bg-green-50/50 shadow-[0_1px_3px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.04)]`}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-slate-500">
              <TrendingUp className="h-4 w-4 text-green-600" aria-hidden="true" />
              <span>Pemasukan</span>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-green-700">
              Rp {pemasukan.toLocaleString("id-ID")}
            </div>
            <div className="mt-1.5 text-xs text-slate-400">{pemasukanCount} transaksi tercatat</div>
          </CardContent>
        </Card>
        <Card
          className={`rounded-2xl border border-green-200 bg-green-50/50 shadow-[0_1px_3px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.04)]`}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-slate-500">
              <TrendingDown className="h-4 w-4 text-red-500" aria-hidden="true" />
              <span>Pengeluaran</span>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-red-600">
              Rp {pengeluaran.toLocaleString("id-ID")}
            </div>
            <div className="mt-1.5 text-xs text-slate-400">Total beban</div>
          </CardContent>
        </Card>
        <Card
          className={`rounded-2xl border border-green-200 bg-green-50/50 shadow-[0_1px_3px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.04)]`}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-slate-500">
              <Wallet className="h-4 w-4 text-green-600" aria-hidden="true" />
              <span>Saldo</span>
            </div>
            <div
              className={`mt-3 text-2xl sm:text-3xl font-semibold tracking-tight ${saldo >= 0 ? "text-green-700" : "text-red-600"}`}
            >
              Rp {saldo.toLocaleString("id-ID")}
            </div>
            <div className="mt-1.5 text-xs text-slate-400">{saldo >= 0 ? "Surplus" : "Defisit"}</div>
            {/* Posisi dana per sumber (seluruh waktu) */}
            <div className="mt-3 space-y-1 border-t border-green-200/60 pt-2.5">
              {posisiDana.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{s.label}</span>
                  <span
                    className={`font-medium tabular-nums ${s.nilai < 0 ? "text-red-600" : "text-slate-700"}`}
                    title={s.nilai < 0 ? "Saldo negatif — cek mutasi sumber dana" : undefined}
                  >
                    Rp {s.nilai.toLocaleString("id-ID")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grafik Dashboard - Line Chart (tren, bukan duplikat total) */}
      <Card className="border-slate-100">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Banknote className="h-4 w-4 text-emerald-700" /> Tren Keuangan
              </CardTitle>
              <p className="mt-1 text-xs text-slate-400">
                Nominal (Rp) · {periode} bulan terakhir — tren, bukan total. Nominal total ada di 3 kartu atas.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-1 rounded-full bg-slate-100 p-1 text-xs font-medium">
              {[3, 6, 12].map((n) => (
                <Link
                  key={n}
                  href={n === 3 ? "/keuangan" : `/keuangan?periode=${n}`}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    periode === n ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {n} bln
                </Link>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 pt-0 pb-4 sm:px-5">
          <KeuanganLineChart data={monthlyData} periodText={`${periode} bulan terakhir`} />
        </CardContent>
      </Card>

      {/* Card Informasi */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-100">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs tracking-wide text-slate-400"><Users className="h-3.5 w-3.5" /> Karyawan</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{karyawanCount}</div>
            <div className="mt-1 text-xs text-slate-400">terdata</div>
            <Link href="/keuangan/karyawan" className="mt-3 inline-flex text-xs font-medium text-emerald-700 hover:underline">Lihat →</Link>
          </CardContent>
        </Card>
        <Card className="border-slate-100">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs tracking-wide text-slate-400"><Package className="h-3.5 w-3.5" /> Aset</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{asetCount}</div>
            <div className="mt-1 text-xs text-slate-400">Nilai total: Rp {formatRupiah(totalAsetValue)}</div>
            <Link href="/keuangan/aset" className="mt-3 inline-flex text-xs font-medium text-emerald-700 hover:underline">Lihat →</Link>
          </CardContent>
        </Card>
        <Card className="border-slate-100">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs tracking-wide text-slate-400"><Boxes className="h-3.5 w-3.5" /> Persediaan</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{barangCount}</div>
            <div className="mt-1 text-xs text-slate-400">jenis barang</div>
            <Link href="/keuangan/persediaan" className="mt-3 inline-flex text-xs font-medium text-emerald-700 hover:underline">Lihat →</Link>
          </CardContent>
        </Card>
        <Card className="border-slate-100">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs tracking-wide text-slate-400"><Wallet className="h-3.5 w-3.5" /> Transaksi</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{transaksiCount}</div>
            <div className="mt-1 text-xs text-slate-400">total</div>
            <Link href="/keuangan/kas" className="mt-3 inline-flex text-xs font-medium text-emerald-700 hover:underline">Lihat →</Link>
          </CardContent>
        </Card>
      </div>

      {/* Transaksi Terbaru */}
      <Card className="border-slate-100">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Wallet className="h-4 w-4 text-emerald-700" /> Transaksi Terbaru
          </CardTitle>
          <Link href="/keuangan/kas" className="mt-2 sm:mt-0">
            <Button variant="outline" size="sm" className="gap-1">
              Lihat Semua <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentTransaksi.length ? (
            <ul className="divide-y divide-slate-100">
              {recentTransaksi.map((t) => (
                <li key={t.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-slate-400 whitespace-nowrap">
                      {new Date(t.tanggal).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{t.kategori}</p>
                      {t.keterangan?.trim() ? (
                        <p className="text-xs text-slate-500">{t.keterangan}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className={`font-semibold ${t.tipe === "PEMASUKAN" ? "text-green-700" : "text-red-600"}`}>
                      {t.tipe === "PEMASUKAN" ? "+" : "-"} Rp {Number(t.jumlah).toLocaleString("id-ID")}
                    </span>
                    <Badge variant={t.tipe === "PEMASUKAN" ? "success" : "destructive"} className="text-xs">
                      {t.tipe === "PEMASUKAN" ? "Masuk" : "Keluar"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">Belum ada transaksi</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
