export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EditMasterForm } from "./edit-form";

export default async function EditPohonMasterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [pohon, panenHist] = await Promise.all([
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
  if (!pohon) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">Edit Pohon — {pohon.id}</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Ubah data pohon
        </p>
      </div>
      <EditMasterForm
        pohon={{
          id: pohon.id,
          namaPohon: pohon.namaPohon || "",
          varietas: pohon.varietas,
          jenis: pohon.jenis || "",
          lokasiBlok: pohon.lokasiBlok,
          tanggalTanam: pohon.tanggalTanam.toISOString().slice(0, 10),
          koordinat: pohon.koordinat || "",
          status: pohon.status,
          hasilPanen: pohon.hasilPanen?.toString?.() ?? "",
          pemupukan: pohon.pemupukan || "",
          pengobatan: pohon.pengobatan || "",
          fotoGeotagUrl: pohon.fotoGeotagUrl || null,
          latitude: pohon.latitude ?? null,
          longitude: pohon.longitude ?? null,
          geotagSource: pohon.geotagSource || null,
        }}
        riwayat={pohon.riwayat.map((r) => ({
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
