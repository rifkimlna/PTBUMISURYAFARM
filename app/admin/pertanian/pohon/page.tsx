import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PohonTable } from "@/components/admin/pohon-table";
import Link from "next/link";
import { Plus, ArrowLeft } from "lucide-react";

export default async function DataPohonPage() {
  const pohon = await prisma.pohon.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { riwayat: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/pertanian">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Data Pohon</h1>
            <p className="text-sm text-slate-500">{pohon.length} pohon terdata • Kelola varietas, blok & status</p>
          </div>
        </div>
        <Link href="/admin/pertanian/pohon/tambah">
          <Button className="rounded-full bg-green-700 hover:bg-green-800">
            <Plus className="h-3.5 w-3.5" /> Tambah Pohon
          </Button>
        </Link>
      </div>

      <Card className="overflow-hidden border-slate-100">
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
            _count: p._count,
          }))}
        />
      </Card>
    </div>
  );
}
