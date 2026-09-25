import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { FakturForm, type FakturInitial } from "@/components/admin/pembelian-forms";

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

// Form Faktur Pembelian baru: supplier, produk, dan akun COA dari database.
// Mendukung prefill dari Pesanan (?dariPesanan=<id>) atau Pengiriman
// (?dariPengiriman=<id>). Utang baru terbentuk saat faktur disimpan.
export default async function FakturBaruPage({
  searchParams,
}: {
  searchParams?: Promise<{ dariPesanan?: string; dariPengiriman?: string }>;
}) {
  const sp = await searchParams;
  const dariPesanan = sp?.dariPesanan?.trim() || "";
  const dariPengiriman = sp?.dariPengiriman?.trim() || "";

  let prefill: FakturInitial | null = null;
  let referensiIds: string[] = [];
  let asalLabel = "";

  if (dariPesanan) {
    const sumber = await prisma.dokumenPembelian.findUnique({
      where: { id: dariPesanan },
      include: { supplier: true, items: { orderBy: { id: "asc" } } },
    });
    if (!sumber || sumber.tipe !== "PESANAN") notFound();
    asalLabel = `Dari Pesanan ${sumber.noDokumen} (${sumber.supplier?.nama ?? "-"})`;
    referensiIds = [sumber.id];
    prefill = {
      id: "",
      header: {
        supplierId: sumber.supplierId ?? "",
        email: sumber.email ?? sumber.supplier?.email ?? "",
        alamat: sumber.alamat ?? sumber.supplier?.alamat ?? "",
        tanggal: todayInput(),
        jatuhTempo: toYMD(sumber.jatuhTempo),
        noRef: sumber.noRefSupplier ?? "",
        syarat: sumber.syaratPembayaran ?? "",
        gudang: sumber.gudang ?? "",
        tag: "",
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
      lockedTotal: false,
      supplierNama: sumber.supplier?.nama,
    };
  } else if (dariPengiriman) {
    const kirim = await prisma.pengirimanPembelian.findUnique({
      where: { id: dariPengiriman },
      include: {
        supplier: true,
        pesanan: { include: { supplier: true } },
        items: { orderBy: { id: "asc" } },
      },
    });
    if (!kirim || !kirim.pesanan) notFound();
    asalLabel = `Dari Penerimaan ${kirim.noPengiriman} (Pesanan ${kirim.pesanan.noDokumen} · ${kirim.supplier.nama})`;
    referensiIds = [kirim.pesanan.id];
    prefill = {
      id: "",
      header: {
        supplierId: kirim.supplierId,
        email: kirim.supplier.email ?? "",
        alamat: kirim.alamatPengiriman ?? "",
        tanggal: todayInput(),
        jatuhTempo: toYMD(kirim.pesanan.jatuhTempo),
        noRef: kirim.noRefSupplier ?? kirim.pesanan.noRefSupplier ?? "",
        syarat: kirim.pesanan.syaratPembayaran ?? "",
        gudang: kirim.gudang ?? kirim.pesanan.gudang ?? "",
        tag: "",
        pesan: kirim.pesan ?? kirim.pesanan.pesan ?? "",
        memo: kirim.memo ?? kirim.pesanan.memo ?? "",
      },
      items: kirim.items.map((it, i) => ({
        key: i + 1,
        produkId: "",
        deskripsi: it.deskripsi,
        kuantitas: String(Number(it.kuantitas)),
        unit: it.unit,
        harga: String(Number(it.harga)),
        diskon: "0",
      })),
      lampiran: [],
      lockedTotal: false,
      supplierNama: kirim.supplier.nama,
    };
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/keuangan/pembelian?tab=faktur"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Pembelian
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Faktur Pembelian</h1>
        <p className="mt-1 text-sm text-slate-400">
          {asalLabel || "Tagihan dari supplier PT Bumi Surya Farm"}
          {prefill && " · Data terbawa otomatis dari dokumen asal"}
        </p>
      </div>
      <FakturForm initial={prefill} referensiIds={referensiIds} asalLabel={asalLabel || undefined} />
    </div>
  );
}
