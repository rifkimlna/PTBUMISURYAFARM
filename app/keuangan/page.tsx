import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Users, Package, Boxes, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";

export default async function KeuanganDashboard() {
  const [transaksiCount, aggKas, karyawanCount, asetCount, barangCount, recentTransaksi] = await Promise.all([
    prisma.transaksiKas.count(),
    prisma.transaksiKas.groupBy({ by: ["tipe"], _sum: { jumlah: true } }),
    prisma.karyawan.count(),
    prisma.aset.count(),
    prisma.persediaanBarang.count(),
    prisma.transaksiKas.findMany({ orderBy: { tanggal: "desc" }, take: 5, include: { admin: { select: { nama: true } } } }),
  ]);

  const pemasukan = Number(aggKas.find((a) => a.tipe === "PEMASUKAN")?._sum.jumlah ?? 0);
  const pengeluaran = Number(aggKas.find((a) => a.tipe === "PENGELUARAN")?._sum.jumlah ?? 0);
  const saldo = pemasukan - pengeluaran;

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
          Keuangan <span className="font-semibold">overview</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">Ringkasan kas, karyawan, aset & persediaan — pt_bst</p>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card className="border-slate-100">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs tracking-wide text-slate-400"><TrendingUp className="h-3.5 w-3.5 text-green-600" /> Pemasukan</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-green-700">Rp {pemasukan.toLocaleString("id-ID")}</div>
            <div className="mt-1 text-xs text-slate-400">{transaksiCount} transaksi tercatat</div>
          </CardContent>
        </Card>
        <Card className="border-slate-100">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs tracking-wide text-slate-400"><TrendingDown className="h-3.5 w-3.5 text-red-500" /> Pengeluaran</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-red-600">Rp {pengeluaran.toLocaleString("id-ID")}</div>
            <div className="mt-1 text-xs text-slate-400">Total beban</div>
          </CardContent>
        </Card>
        <Card className={saldo >= 0 ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}>
          <CardContent className="p-5">
            <div className="text-xs tracking-wide text-slate-400">Saldo</div>
            <div className={`mt-2 text-2xl font-semibold tracking-tight ${saldo >= 0 ? "text-green-700" : "text-red-600"}`}>Rp {saldo.toLocaleString("id-ID")}</div>
            <div className="mt-1 text-xs text-slate-400">{saldo >= 0 ? "Surplus" : "Defisit"}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Karyawan", value: karyawanCount, href: "/keuangan/karyawan", icon: Users, hint: "terdata" },
          { label: "Aset", value: asetCount, href: "/keuangan/aset", icon: Package, hint: "inventaris" },
          { label: "Persediaan", value: barangCount, href: "/keuangan/persediaan", icon: Boxes, hint: "jenis barang" },
          { label: "Transaksi", value: transaksiCount, href: "/keuangan/kas", icon: Wallet, hint: "total" },
        ].map((s) => (
          <Card key={s.label} className="border-slate-100">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-xs tracking-wide text-slate-400"><s.icon className="h-3.5 w-3.5" /> {s.label}</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{s.value}</div>
              <div className="mt-1 text-xs text-slate-400">{s.hint}</div>
              <Link href={s.href} className="mt-3 inline-flex text-xs font-medium text-emerald-700 hover:underline">Lihat →</Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm"><Wallet className="h-4 w-4 text-emerald-700" /> Keuangan Kas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">Kelola pemasukan, pengeluaran, sumber dana & bukti transaksi.</p>
            <ul className="text-xs text-slate-500 list-disc pl-4 space-y-1">
              {recentTransaksi.length ? recentTransaksi.map((t) => (
                <li key={t.id} className="truncate">{t.kategori} — Rp {Number(t.jumlah).toLocaleString("id-ID")} ({t.tipe})</li>
              )) : <li>Belum ada transaksi</li>}
            </ul>
            <Link href="/keuangan/kas" className="block">
              <Button className="bg-emerald-700 hover:bg-emerald-800 w-full sm:w-auto">Buka Kas <ArrowRight className="h-4 w-4" /></Button>
            </Link>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4" /> Karyawan</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">{karyawanCount} karyawan • kelola gaji & divisi.</p>
              <Link href="/keuangan/karyawan"><Button variant="outline" className="w-full sm:w-auto">Kelola Karyawan <ArrowRight className="h-4 w-4" /></Button></Link>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Package className="h-4 w-4" /> Aset & Persediaan</CardTitle></CardHeader>
            <CardContent className="flex gap-2 flex-wrap">
              <Link href="/keuangan/aset"><Button variant="outline" size="sm">Inventaris Aset ({asetCount})</Button></Link>
              <Link href="/keuangan/persediaan"><Button variant="outline" size="sm">Persediaan ({barangCount})</Button></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
