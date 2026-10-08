import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PengirimanBeliForm } from "@/components/admin/pembelian-dokumen-form";

// Form Penerimaan dari Pesanan (PO): supplier & produk terbawa otomatis.
export default async function PengirimanBeliBaruPage({
  searchParams,
}: {
  searchParams?: Promise<{ pesananId?: string }>;
}) {
  const sp = await searchParams;
  const pesananId = sp?.pesananId?.trim() || "";
  if (!pesananId) notFound();

  const pesanan = await prisma.dokumenPembelian.findUnique({
    where: { id: pesananId },
    include: {
      supplier: true,
      items: { orderBy: { id: "asc" } },
    },
  });
  if (!pesanan || pesanan.tipe !== "PESANAN") notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/keuangan/pembelian?tab=pesanan"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Pembelian
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Penerimaan Pembelian</h1>
        <p className="mt-1 text-sm text-slate-400">Buat penerimaan dari Pesanan {pesanan.noDokumen}</p>
      </div>
      <PengirimanBeliForm
        pesanan={{
          id: pesanan.id,
          noDokumen: pesanan.noDokumen,
          supplierNama: pesanan.supplier?.nama ?? "-",
          supplierEmail: pesanan.supplier?.email ?? null,
          alamat: pesanan.alamat,
          noRefSupplier: pesanan.noRefSupplier,
          gudang: pesanan.gudang,
          pesan: pesanan.pesan,
          memo: pesanan.memo,
          items: pesanan.items.map((it) => ({
            deskripsi: it.deskripsi,
            kuantitas: Number(it.kuantitas),
            unit: it.unit,
            harga: Number(it.harga),
            jumlah: Number(it.jumlah),
          })),
        }}
      />
    </div>
  );
}
