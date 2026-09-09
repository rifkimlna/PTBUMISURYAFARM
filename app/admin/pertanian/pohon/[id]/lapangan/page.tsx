import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { LapanganClient } from "./lapangan-client";

export default async function LapanganPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pohon = await prisma.pohon.findUnique({
    where: { id },
    include: { riwayat: { orderBy: { tanggalCek: "desc" }, take: 10, include: { petugas: { select: { nama: true } } } } },
  });
  if (!pohon) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Data Lapangan — {pohon.id}</h1>
        <p className="text-sm text-slate-500">
          {(pohon as any).namaPohon || pohon.varietas} • {pohon.lokasiBlok} • Snapshot + Riwayat harian
        </p>
      </div>
      <LapanganClient
        pohon={{
          id: pohon.id,
          hasilPanen: (pohon as any).hasilPanen?.toString?.() ?? "",
          pemupukan: (pohon as any).pemupukan || "",
          pengobatan: (pohon as any).pengobatan || "",
          status: pohon.status as string,
        }}
        riwayat={pohon.riwayat.map((r) => ({
          id: r.id,
          gejala: r.gejala,
          tindakan: r.tindakan,
          fotoUrl: r.fotoUrl,
          tanggalCek: r.tanggalCek.toISOString(),
          petugasNama: r.petugas.nama,
        }))}
      />
    </div>
  );
}
