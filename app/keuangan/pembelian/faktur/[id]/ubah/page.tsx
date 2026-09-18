import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { FakturForm, type FakturInitial } from "@/components/admin/pembelian-forms";

function toYMD(value: Date | null) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Halaman ubah faktur: memakai form yang SAMA dengan form input awal (mode edit).
export default async function UbahFakturPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const faktur = await prisma.fakturPembelian.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { orderBy: { id: "asc" } },
      lampiran: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!faktur) notFound();

  const pembayaranCount = faktur.tagihanId
    ? await prisma.transaksiKas.count({ where: { tagihanId: faktur.tagihanId } })
    : 0;

  const initial: FakturInitial = {
    id: faktur.id,
    noFaktur: faktur.noFaktur,
    header: {
      supplierId: faktur.supplierId,
      email: faktur.email ?? "",
      alamat: faktur.alamat ?? "",
      tanggal: toYMD(faktur.tanggal),
      jatuhTempo: toYMD(faktur.jatuhTempo),
      noRef: faktur.noRefSupplier ?? "",
      syarat: faktur.syaratPembayaran ?? "",
      gudang: faktur.gudang ?? "",
      tag: faktur.tag ?? "",
      pesan: faktur.pesan ?? "",
      memo: faktur.memo ?? "",
    },
    items: faktur.items.map((it, i) => ({
      key: i + 1,
      produkId: it.produkId ?? "",
      deskripsi: it.deskripsi,
      kuantitas: String(Number(it.kuantitas)),
      unit: it.unit,
      harga: String(Number(it.harga)),
      diskon: String(Number(it.diskonPersen)),
    })),
    lampiran: faktur.lampiran.map((l) => ({
      key: l.id,
      id: l.id,
      fileName: l.fileName,
      fileUrl: l.fileUrl,
      fileType: l.fileType,
      fileSize: l.fileSize,
    })),
    lockedTotal: pembayaranCount > 0,
    supplierNama: faktur.supplier.nama,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href={`/keuangan/pembelian/faktur/${id}`}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Detail
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Ubah Faktur {faktur.noFaktur}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {faktur.supplier.nama} · Total Rp {Number(faktur.total).toLocaleString("id-ID")}
        </p>
      </div>
      <FakturForm initial={initial} />
    </div>
  );
}
