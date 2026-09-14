export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScanLine } from "lucide-react";
import { PohonTable } from "@/components/admin/pohon-table";
import { StatusDonut } from "@/components/admin/status-donut";
import { BarHasilBlok } from "@/components/admin/bar-hasil-blok";
import { PanenChart } from "@/components/admin/panen-chart";
import Link from "next/link";

export default async function PertanianDashboard() {
  const tujuhHari = new Date();
  tujuhHari.setDate(tujuhHari.getDate() + 7);
  const [total, sehat, perhatian, sakit, tanpaGeotag, pohon, sumHasil, panenTotal, sudahPanen, jadwalMendesak, antrean] = await Promise.all([
    prisma.pohon.count(),
    prisma.pohon.count({ where: { status: "SEHAT" } }),
    prisma.pohon.count({ where: { status: "PERLU_PERHATIAN" } }),
    prisma.pohon.count({ where: { status: "SAKIT" } }),
    prisma.pohon.count({ where: { fotoGeotagUrl: null } }),
    prisma.pohon.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { _count: { select: { riwayat: true } } } }),
    prisma.pohon.aggregate({ _sum: { hasilPanen: true } }),
    prisma.panen.aggregate({ _sum: { jumlahKg: true }, _count: { _all: true } }),
    prisma.pohon.count({ where: { hasilPanen: { not: null } } }),
    prisma.jadwalPerawatan.count({ where: { status: "RENCANA", tanggalRencana: { lte: tujuhHari } } }),
    prisma.pohon.findMany({
      where: { status: { in: ["SAKIT", "PERLU_PERHATIAN"] } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, lokasiBlok: true, status: true, varietas: true },
    }),
  ]);
  const totalKg = Number(sumHasil._sum.hasilPanen ?? 0);
  const panenKg = Number(panenTotal._sum.jumlahKg ?? 0);
  const displayKg = panenKg > 0 ? panenKg : totalKg;
  const rataKg = total ? displayKg / total : 0;

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
            Perkebunan
          </h1>
          <p className="mt-1 text-sm text-slate-400">Ringkasan kebun</p>
        </div>
        <Link href="/perkebunan/scan" className="shrink-0">
          <Button className="rounded-full px-5 w-full sm:w-auto cursor-pointer">
            <ScanLine className="h-3.5 w-3.5" /> Scan
          </Button>
        </Link>
      </div>

      {tanpaGeotag > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-sm font-medium text-amber-800">⚠️ {tanpaGeotag} pohon belum ada foto</div>
          <Link href="/perkebunan/pohon?hasGeotag=false" className="text-xs font-medium text-amber-800 underline shrink-0">Lihat →</Link>
        </div>
      )}

      {jadwalMendesak > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-sm font-medium text-green-800">{jadwalMendesak} jadwal perawatan mendesak (terlewat / ≤7 hari)</div>
          <Link href="/perkebunan/jadwal" className="text-xs font-medium text-green-800 underline shrink-0">Lihat →</Link>
        </div>
      )}

      {antrean.length > 0 && (
        <Card className="border-red-100">
          <div className="flex items-center justify-between border-b border-slate-50 px-4 sm:px-6 py-4 gap-2">
            <div className="text-sm font-medium tracking-tight text-slate-900">Perlu tindakan</div>
            <Link href="/perkebunan/pohon" className="text-xs font-medium text-red-700 hover:underline shrink-0">{antrean.length} pohon →</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {antrean.map((p) => (
              <Link key={p.id} href={`/perkebunan/pohon/${p.id}/edit`} className="flex items-center gap-3 px-4 sm:px-6 py-2.5 hover:bg-slate-50">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${p.status === "SAKIT" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  {p.status === "SAKIT" ? "Sakit" : "Perhatian"}
                </span>
                <span className="font-mono text-xs text-slate-900 truncate">{p.id}</span>
                <span className="ml-auto text-xs text-slate-400 shrink-0">{p.lokasiBlok}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total", value: total, hint: "pohon", accent: "" },
          { label: "Sehat", value: sehat, hint: "pohon", accent: "text-green-800" },
          { label: "Perhatian", value: perhatian, hint: "pohon", accent: "text-amber-600" },
          { label: "Sakit", value: sakit, hint: "pohon", accent: "text-red-500" },
        ].map((s) => (
          <Card key={s.label} className="border-slate-100">
            <CardContent className="p-5">
              <div className="text-xs tracking-wide text-slate-400">{s.label}</div>
              <div className={`mt-2 text-3xl font-semibold tracking-tight ${s.accent || "text-slate-900"}`}>{s.value}</div>
              <div className="mt-1 text-xs text-slate-400">{s.hint}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Panen - minimalis, terbaca semua kalangan */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium tracking-tight text-slate-900">Panen</div>
        <Link href="/perkebunan/panen" className="text-xs font-medium text-green-800 hover:underline shrink-0">Kelola →</Link>
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card className="border-slate-100"><CardContent className="p-5"><div className="text-xs tracking-wide text-slate-400">Total Panen</div><div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{displayKg.toLocaleString("id-ID", { maximumFractionDigits: 1 })} KG</div><div className="mt-1 text-xs text-slate-400">{panenTotal._count._all > 0 ? `${panenTotal._count._all} panen tercatat` : `${sudahPanen} pohon sudah panen`}</div></CardContent></Card>
        <Card className="border-slate-100"><CardContent className="p-5"><div className="text-xs tracking-wide text-slate-400">Rata-rata</div><div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{rataKg.toLocaleString("id-ID", { maximumFractionDigits: 1 })} KG</div><div className="mt-1 text-xs text-slate-400">per pohon</div></CardContent></Card>
        <Card className="border-slate-100"><CardContent className="p-5"><div className="text-xs tracking-wide text-slate-400">Sudah Panen</div><div className="mt-2 text-2xl font-semibold tracking-tight text-green-700">{sudahPanen}/{total}</div><div className="mt-1 text-xs text-slate-400">{total ? Math.round((sudahPanen / total) * 100) : 0}% pohon</div></CardContent></Card>
      </div>

      {/* Chart Grid - auto layout HP 1 kolom, tablet 2, desktop 2+1 */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        <StatusDonut />
        <BarHasilBlok groupBy="blok" />
      </div>
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        <BarHasilBlok groupBy="jenis" />
        <PanenChart />
      </div>

      <Card className="overflow-hidden border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-50 px-4 sm:px-6 py-4 gap-2">
          <div className="text-sm font-medium tracking-tight text-slate-900">Data Pohon</div>
          <div className="text-xs text-slate-400 shrink-0">{pohon.length} entri</div>
        </div>
        <PohonTable
          data={pohon.map((p: any) => ({
            id: p.id,
            namaPohon: p.namaPohon,
            varietas: p.varietas,
            jenis: p.jenis,
            lokasiBlok: p.lokasiBlok,
            tanggalTanam: p.tanggalTanam.toISOString(),
            koordinat: p.koordinat,
            hasilPanen: p.hasilPanen?.toString?.() ?? p.hasilPanen,
            pemupukan: p.pemupukan,
            pengobatan: p.pengobatan,
            status: p.status as string,
            fotoGeotagUrl: p.fotoGeotagUrl,
            latitude: p.latitude,
            longitude: p.longitude,
            geotagSource: p.geotagSource,
            geotagTimestamp: p.geotagTimestamp?.toISOString?.() ?? null,
            _count: (p as any)._count,
          }))}
        />
      </Card>
    </div>
  );
}
