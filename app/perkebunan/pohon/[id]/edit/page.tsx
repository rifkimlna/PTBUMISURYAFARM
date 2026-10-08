export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EditMasterForm } from "./edit-form";
import { DbErrorBanner } from "@/components/admin/db-error-banner";

export default async function EditPohonMasterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let pohon: any = null;
  let panenHist: { jumlahKg: unknown; tanggalPanen: Date }[] = [];
  let dbError = false;
  try {
    [pohon, panenHist] = await Promise.all([
      prisma.pohon.findUnique({
        where: { id },
        include: { riwayat: { orderBy: { tanggalCek: "desc" }, take: 10, include: { petugas: { select: { nama: true } } } } },
      }),
      prisma.panen.findMany({
        where: { pohonId: id },
        orderBy: { tanggalPanen: "desc" },
        take: 1,
        select: { jumlahKg: true, tanggalPanen: true },
      }),
    ]);
  } catch (e) {
    console.error("[perkebunan/pohon/edit] database tidak terjangkau:", e instanceof Error ? e.message : e);
    dbError = true;
  }
  if (!pohon) {
    if (dbError) {
      return (
        <div className="mx-auto max-w-3xl space-y-6">
          <DbErrorBanner />
        </div>
      );
    }
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="min-w-0">
        <h1 className="text-base sm:text-xl font-semibold tracking-tight text-slate-900 truncate">Edit Pohon — {pohon.id}</h1>
        <p className="text-[11px] sm:text-sm text-slate-500">
          Ubah data pohon
        </p>
      </div>
      <EditMasterForm
        pohon={{
          id: pohon.id,
          namaPohon: pohon.namaPohon || "",
          varietas: pohon.varietas,
          lokasiBlok: pohon.lokasiBlok,
          tanggalTanam: pohon.tanggalTanam.toISOString().slice(0, 10),
          koordinat: pohon.koordinat || "",
          status: pohon.status,
          hasilPanen: (pohon as any).hasilPanen?.toString?.() ?? "",
          pemupukan: (pohon as any).pemupukan || "",
          pengobatan: (pohon as any).pengobatan || "",
          tinggiCm: (pohon as any).tinggiCm != null ? String((pohon as any).tinggiCm) : "",
          lingkarBatangCm: (pohon as any).lingkarBatangCm != null ? String((pohon as any).lingkarBatangCm) : "",
          phTanah: (pohon as any).phTanah != null ? String((pohon as any).phTanah) : "",
          fotoGeotagUrl: pohon.fotoGeotagUrl || null,
          latitude: pohon.latitude ?? null,
          longitude: pohon.longitude ?? null,
          geotagSource: pohon.geotagSource || null,
        }}
        riwayat={pohon.riwayat.map((r: any) => ({
          id: r.id,
          gejala: r.gejala,
          tindakan: r.tindakan,
          fotoUrl: r.fotoUrl,
          tanggalCek: r.tanggalCek.toISOString(),
          petugasNama: r.petugas.nama,
        }))}
        panenTerakhir={
          panenHist[0]
            ? { kg: String(panenHist[0].jumlahKg), tanggal: panenHist[0].tanggalPanen.toISOString() }
            : null
        }
      />
    </div>
  );
}
