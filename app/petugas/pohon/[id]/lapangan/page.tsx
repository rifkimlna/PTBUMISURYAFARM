import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PetugasLapanganMinimal } from "@/components/petugas/lapangan-minimal";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function PetugasLapanganPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pohon = await prisma.pohon.findUnique({
    where: { id },
    include: { riwayat: { orderBy: { tanggalCek: "desc" }, take: 10, include: { petugas: { select: { nama: true } } } } },
  });
  if (!pohon) notFound();

  return (
    <div className="space-y-4 sm:space-y-5">
      <Link href="/petugas/scan" className="inline-flex">
        <Button variant="ghost" size="sm" className="rounded-full -ml-2 -mb-1">
          <ArrowLeft className="h-4 w-4" /> Scan Lagi
        </Button>
      </Link>

      {/* Header ringkas — tanpa gambar, fokus update */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] font-bold tracking-widest text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-full">{pohon.id}</span>
              <Badge variant={pohon.status === "SEHAT" ? "sehat" : pohon.status === "PERLU_PERHATIAN" ? "perhatian" : pohon.status === "SAKIT" ? "sakit" : "secondary"} className="shrink-0">{pohon.status}</Badge>
            </div>
            <h1 className="mt-2 text-[18px] font-semibold tracking-tight text-slate-900 leading-tight truncate">{(pohon as any).namaPohon || pohon.varietas}</h1>
            <p className="text-sm text-slate-600">{pohon.jenis || pohon.varietas} • {pohon.lokasiBlok}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full bg-slate-900 text-white px-2.5 py-1 text-xs font-medium">{pohon.lokasiBlok}</span>
          <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2.5 py-1 text-xs">{new Date(pohon.tanggalTanam).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>
          {pohon.koordinat && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(pohon.koordinat)}`} target="_blank" className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-xs border border-emerald-100">
              <MapPin className="h-3 w-3" /> Lihat Map
            </a>
          )}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Fokus update data di bawah — hasil panen, pupuk & obat. Tersimpan otomatis ke data global perkebunan.</p>
      </div>

      <PetugasLapanganMinimal
        pohon={{
          id: pohon.id,
          hasilPanen: (pohon as any).hasilPanen?.toString?.() ?? "",
          pemupukan: (pohon as any).pemupukan || "",
          pengobatan: (pohon as any).pengobatan || "",
          status: pohon.status as string,
        }}
      />

      {/* Riwayat ringkas - auto hide kalau kosong biar minimalis */}
      {pohon.riwayat.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
          <div className="text-sm font-semibold tracking-tight text-slate-900">Riwayat 3 Terbaru</div>
          <div className="mt-3 space-y-2">
            {pohon.riwayat.slice(0, 3).map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <div className="text-xs text-slate-500">{new Date(r.tanggalCek).toLocaleDateString("id-ID")} • {r.petugas.nama}</div>
                <div className="text-sm font-medium text-slate-900 truncate">{r.gejala}</div>
                <div className="text-xs text-slate-600 truncate">→ {r.tindakan}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
