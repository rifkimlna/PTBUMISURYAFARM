import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PohonTable } from "@/components/admin/pohon-table";
import Link from "next/link";

export default async function PertanianDashboard() {
  const [total, sehat, perhatian, sakit, tanpaGeotag, pohon] = await Promise.all([
    prisma.pohon.count(),
    prisma.pohon.count({ where: { status: "SEHAT" } }),
    prisma.pohon.count({ where: { status: "PERLU_PERHATIAN" } }),
    prisma.pohon.count({ where: { status: "SAKIT" } }),
    prisma.pohon.count({ where: { fotoGeotagUrl: null } }),
    prisma.pohon.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { _count: { select: { riwayat: true } } } }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Pertanian <span className="font-semibold">overview</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Ringkasan kesehatan — pt_bst</p>
        </div>
        <Link href="/admin/pertanian/scan">
          <Button className="rounded-full px-5">
            <Plus className="h-3.5 w-3.5" /> Update
          </Button>
        </Link>
      </div>

      {tanpaGeotag > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-medium text-amber-800">⚠️ {tanpaGeotag} pohon tanpa foto geotag wajib</div>
          <Link href="/admin/pertanian/pohon?hasGeotag=false" className="text-xs font-medium text-amber-800 underline">Lihat →</Link>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total", value: total, hint: "pohon" },
          { label: "Sehat", value: sehat, hint: "green", accent: "text-green-800" },
          { label: "Perhatian", value: perhatian, hint: "amber", accent: "text-amber-600" },
          { label: "Sakit", value: sakit, hint: "red", accent: "text-red-500" },
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

      <Card className="overflow-hidden border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-50 px-6 py-4">
          <div className="text-sm font-medium tracking-tight text-slate-900">Data Pohon</div>
          <div className="text-xs text-slate-400">{pohon.length} entri</div>
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
