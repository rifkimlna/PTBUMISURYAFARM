import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DokumenBeliForm, type DokBeliInitial, type TipeDokBeli } from "@/components/admin/pembelian-dokumen-form";

const TIPE_DB: Record<string, TipeDokBeli> = {
  permintaan: "PERMINTAAN",
  penawaran: "PENAWARAN",
  pesanan: "PESANAN",
};

function toYMD(value: Date | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Ubah dokumen memakai form yang sama seperti input awal.
export default async function UbahDokumenBeliPage({
  params,
}: {
  params: Promise<{ tipe: string; id: string }>;
}) {
  const { tipe: slug, id } = await params;
  const tipe = TIPE_DB[slug?.toLowerCase()];
  if (!tipe) notFound();

  const doc = await prisma.dokumenPembelian.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { orderBy: { id: "asc" } },
      lampiran: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!doc || doc.tipe !== tipe) notFound();

  const initial: DokBeliInitial = {
    id: doc.id,
    header: {
      supplierId: doc.supplierId ?? "",
      departemen: doc.departemen ?? "",
      email: doc.email ?? doc.supplier?.email ?? "",
      alamat: doc.alamat ?? doc.supplier?.alamat ?? "",
      tanggal: toYMD(doc.tanggal),
      jatuhTempo: toYMD(doc.jatuhTempo),
      noRef: doc.noRefSupplier ?? "",
      syarat: doc.syaratPembayaran ?? "",
      gudang: doc.gudang ?? "",
      pesan: doc.pesan ?? "",
      memo: doc.memo ?? "",
    },
    items: doc.items.map((it, i) => ({
      key: i + 1,
      produkId: it.produkId ?? "",
      deskripsi: it.deskripsi,
      kuantitas: String(Number(it.kuantitas)),
      unit: it.unit,
      harga: String(Number(it.harga)),
      diskon: String(Number(it.diskonPersen)),
    })),
    lampiran: doc.lampiran.map((l) => ({
      key: l.id,
      id: l.id,
      fileName: l.fileName,
      fileUrl: l.fileUrl,
      fileType: l.fileType,
      fileSize: l.fileSize,
    })),
    referensiIds: doc.referensiIds,
    supplierNama: doc.supplier?.nama,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href={`/keuangan/pembelian/dokumen/${slug.toLowerCase()}/${doc.id}`}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Detail
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Ubah {doc.noDokumen}</h1>
        <p className="mt-1 text-sm text-slate-400">Form yang sama seperti input awal</p>
      </div>
      <DokumenBeliForm tipe={tipe} initial={initial} />
    </div>
  );
}
