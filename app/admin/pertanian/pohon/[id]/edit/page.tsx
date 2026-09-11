import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EditMasterForm } from "./edit-form";

export default async function EditPohonMasterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pohon = await prisma.pohon.findUnique({
    where: { id },
    include: { riwayat: { orderBy: { tanggalCek: "desc" }, take: 10, include: { petugas: { select: { nama: true } } } } },
  });
  if (!pohon) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Koreksi Data Pohon — {pohon.id}</h1>
        <p className="text-sm text-slate-500">
          Admin full — identitas + snapshot lapangan + riwayat • Scan langsung kesini untuk koreksi kesalahan
        </p>
      </div>
      <EditMasterForm
        pohon={{
          id: pohon.id,
          namaPohon: (pohon as any).namaPohon || "",
          varietas: pohon.varietas,
          jenis: (pohon as any).jenis || "",
          lokasiBlok: pohon.lokasiBlok,
          tanggalTanam: pohon.tanggalTanam.toISOString().slice(0, 10),
          koordinat: (pohon as any).koordinat || "",
          status: pohon.status as string,
          hasilPanen: (pohon as any).hasilPanen?.toString?.() ?? "",
          pemupukan: (pohon as any).pemupukan || "",
          pengobatan: (pohon as any).pengobatan || "",
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
