import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PengirimanForm } from "@/components/admin/pengiriman-form";

// Form Pengiriman dari Pesanan: pelanggan & produk terbawa otomatis.
export default async function PengirimanBaruPage({
  searchParams,
}: {
  searchParams?: Promise<{ pesananId?: string }>;
}) {
  const sp = await searchParams;
  const pesananId = sp?.pesananId?.trim() || "";
  if (!pesananId) notFound();

  const pesanan = await prisma.dokumenPenjualan.findUnique({
    where: { id: pesananId },
    include: {
      pelanggan: true,
      items: { orderBy: { id: "asc" } },
    },
  });
  if (!pesanan || pesanan.tipe !== "PESANAN") notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href={`/keuangan/penjualan/pesanan/${pesanan.id}`}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Detail Pesanan
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Pengiriman Penjualan</h1>
        <p className="mt-1 text-sm text-slate-400">Buat pengiriman dari Pesanan {pesanan.noDokumen}</p>
      </div>
      <PengirimanForm
        pesanan={{
          id: pesanan.id,
          noDokumen: pesanan.noDokumen,
          pelangganNama: pesanan.pelanggan.nama,
          pelangganEmail: pesanan.pelanggan.email,
          alamat: pesanan.alamat,
          noRefPelanggan: pesanan.noRefPelanggan,
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
