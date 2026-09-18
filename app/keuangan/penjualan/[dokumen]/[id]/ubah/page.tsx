import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  PenagihanForm,
  ProformaForm,
  TukarFakturForm,
  PesananForm,
  PenawaranForm,
  type DocInitial,
} from "@/components/admin/penjualan-forms";

const TIPE_BY_SLUG: Record<string, "PENAGIHAN" | "PROFORMA" | "TUKAR_FAKTUR" | "PESANAN" | "PENAWARAN"> = {
  penagihan: "PENAGIHAN",
  proforma: "PROFORMA",
  "tukar-faktur": "TUKAR_FAKTUR",
  pesanan: "PESANAN",
  penawaran: "PENAWARAN",
};

function toYMD(value: Date | null) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Halaman ubah dokumen: memakai form yang SAMA dengan form input awal (mode edit).
export default async function UbahDokumenPage({
  params,
}: {
  params: Promise<{ dokumen: string; id: string }>;
}) {
  const { dokumen: slug, id } = await params;
  const tipe = TIPE_BY_SLUG[slug?.toLowerCase()];
  if (!tipe) notFound();

  const doc = await prisma.dokumenPenjualan.findUnique({
    where: { id },
    include: {
      pelanggan: true,
      items: { orderBy: { id: "asc" } },
      lampiran: { orderBy: { createdAt: "asc" } },
      tagihan: { select: { jenis: true } },
    },
  });
  if (!doc || doc.tipe !== tipe) notFound();

  const pembayaranCount = doc.tagihanId
    ? await prisma.transaksiKas.count({ where: { tagihanId: doc.tagihanId } })
    : 0;

  const initial: DocInitial = {
    id: doc.id,
    header: {
      pelangganId: doc.pelangganId,
      email: doc.email ?? "",
      alamat: doc.alamat ?? "",
      tanggal: toYMD(doc.tanggal),
      jatuhTempo: toYMD(doc.jatuhTempo),
      noRef: doc.noRefPelanggan ?? "",
      syarat: doc.syaratPembayaran ?? "",
      pesan: doc.pesan ?? "",
      memo: doc.memo ?? "",
      jenis: (doc.tagihan?.jenis ?? "HASIL_KEBUN") as "HASIL_KEBUN" | "TERNAK" | "IKAN" | "LAINNYA",
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
    lockedTotal: pembayaranCount > 0,
    referensiIds: doc.referensiIds,
    pelangganNama: doc.pelanggan.nama,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href={`/keuangan/penjualan/${slug}/${id}`}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Detail
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Ubah Dokumen {doc.noDokumen}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {doc.pelanggan.nama} · Total Rp {Number(doc.total).toLocaleString("id-ID")}
        </p>
      </div>
      {tipe === "PENAGIHAN" && <PenagihanForm initial={initial} />}
      {tipe === "PROFORMA" && <ProformaForm initial={initial} />}
      {tipe === "TUKAR_FAKTUR" && <TukarFakturForm initial={initial} />}
      {tipe === "PESANAN" && <PesananForm initial={initial} />}
      {tipe === "PENAWARAN" && <PenawaranForm initial={initial} />}
    </div>
  );
}
