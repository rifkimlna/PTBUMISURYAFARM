import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DokumenBeliForm, type DokBeliInitial } from "@/components/admin/pembelian-dokumen-form";

// Versi server dari todayInput (file form adalah Client Component).
function todayInput() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function toYMD(value: Date | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Penawaran bisa dibuat langsung atau dari Permintaan (?dari=<id>).
export default async function PenawaranBaruPage({
  searchParams,
}: {
  searchParams?: Promise<{ dari?: string }>;
}) {
  const sp = await searchParams;
  const dari = sp?.dari?.trim() || "";

  let prefill: DokBeliInitial | null = null;
  let asalLabel = "";
  if (dari) {
    const sumber = await prisma.dokumenPembelian.findUnique({
      where: { id: dari },
      include: { supplier: true, items: { orderBy: { id: "asc" } } },
    });
    if (!sumber || sumber.tipe !== "PERMINTAAN") notFound();
    asalLabel = `Dari ${sumber.noDokumen}${sumber.supplier ? ` (${sumber.supplier.nama})` : ""}`;
    prefill = {
      id: "",
      header: {
        supplierId: sumber.supplierId ?? "",
        departemen: sumber.departemen ?? "",
        email: sumber.email ?? sumber.supplier?.email ?? "",
        alamat: sumber.alamat ?? sumber.supplier?.alamat ?? "",
        tanggal: todayInput(),
        jatuhTempo: toYMD(sumber.jatuhTempo),
        noRef: sumber.noRefSupplier ?? "",
        syarat: sumber.syaratPembayaran ?? "",
        gudang: sumber.gudang ?? "",
        pesan: sumber.pesan ?? "",
        memo: sumber.memo ?? "",
      },
      items: sumber.items.map((it, i) => ({
        key: i + 1,
        produkId: it.produkId ?? "",
        deskripsi: it.deskripsi,
        kuantitas: String(Number(it.kuantitas)),
        unit: it.unit,
        harga: String(Number(it.harga)),
        diskon: String(Number(it.diskonPersen)),
      })),
      lampiran: [],
      referensiIds: [sumber.id],
      supplierNama: sumber.supplier?.nama,
    };
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/keuangan/pembelian?tab=penawaran"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Pembelian
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Penawaran Pembelian</h1>
        <p className="mt-1 text-sm text-slate-400">
          {asalLabel || "Penawaran harga dari supplier"}
          {prefill && " · Data terbawa otomatis dari dokumen asal"}
        </p>
      </div>
      <DokumenBeliForm tipe="PENAWARAN" initial={prefill} />
    </div>
  );
}
