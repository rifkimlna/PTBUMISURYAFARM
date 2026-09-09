import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EditMasterForm } from "./edit-form";

export default async function EditPohonMasterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pohon = await prisma.pohon.findUnique({ where: { id } });
  if (!pohon) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Edit Data Pohon — Master</h1>
        <p className="text-sm text-slate-500">
          ID <span className="font-mono font-medium text-slate-900">{pohon.id}</span> • Identitas jarang berubah • Pemupukan/panen di Data Lapangan terpisah
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
        }}
      />
    </div>
  );
}
