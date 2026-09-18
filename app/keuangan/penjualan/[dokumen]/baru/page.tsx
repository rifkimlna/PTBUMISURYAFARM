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
  todayInput,
  type DocInitial,
} from "@/components/admin/penjualan-forms";

const JUDUL: Record<string, { judul: string; sub: string; tipe: "PENAGIHAN" | "PROFORMA" | "TUKAR_FAKTUR" | "PESANAN" | "PENAWARAN" }> = {
  penagihan: { judul: "Penagihan Penjualan", sub: "Invoice resmi ke pelanggan PT Bumi Surya Farm", tipe: "PENAGIHAN" },
  proforma: { judul: "Faktur Proforma", sub: "Dokumen sementara, bukan tagihan resmi", tipe: "PROFORMA" },
  "tukar-faktur": { judul: "Tukar Faktur", sub: "Berdasarkan faktur/penagihan yang sudah ada", tipe: "TUKAR_FAKTUR" },
  pesanan: { judul: "Pesanan Penjualan", sub: "Sales order dari pelanggan", tipe: "PESANAN" },
  penawaran: { judul: "Penawaran Penjualan", sub: "Quotation harga ke pelanggan", tipe: "PENAWARAN" },
};

function toYMD(value: Date | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Form baru mendukung prefill dari dokumen asal (?dari=<id>&mode=duplikat):
// - Penawaran -> Pesanan / Penagihan (data pelanggan & produk terbawa, referensi tersimpan).
// - Pesanan -> Penagihan (data terbawa, referensi tersimpan).
// - Duplikat: tipe sama, salinan dapat diedit sebelum disimpan (nomor baru saat simpan).
// Hanya PENAGIHAN yang kelak menghasilkan piutang (di API); dokumen lain tanpa Kas.
export default async function DokumenBaruPage({
  params,
  searchParams,
}: {
  params: Promise<{ dokumen: string }>;
  searchParams?: Promise<{ dari?: string; mode?: string }>;
}) {
  const { dokumen } = await params;
  const sp = await searchParams;
  const meta = JUDUL[dokumen?.toLowerCase()];
  if (!meta) notFound();

  let prefill: DocInitial | null = null;
  let asalLabel = "";
  const dari = sp?.dari?.trim() || "";
  const duplikat = (sp?.mode || "").toLowerCase() === "duplikat";

  if (dari) {
    const sumber = await prisma.dokumenPenjualan.findUnique({
      where: { id: dari },
      include: {
        pelanggan: true,
        items: { orderBy: { id: "asc" } },
      },
    });
    // Validasi alur yang diizinkan (tanpa memaksa seluruh tahapan):
    // PENAWARAN -> PESANAN | PENAGIHAN (+duplikat), PESANAN -> PENAGIHAN (+duplikat),
    // PENAGIHAN -> duplikat saja.
    const allowed =
      (sumber?.tipe === "PENAWARAN" && (meta.tipe === "PESANAN" || meta.tipe === "PENAGIHAN" || (duplikat && meta.tipe === "PENAWARAN"))) ||
      (sumber?.tipe === "PESANAN" && (meta.tipe === "PENAGIHAN" || (duplikat && meta.tipe === "PESANAN"))) ||
      (sumber?.tipe === "PENAGIHAN" && duplikat && meta.tipe === "PENAGIHAN");
    if (sumber && allowed) {
      asalLabel = `Dari ${sumber.noDokumen} (${sumber.pelanggan.nama})`;
      prefill = {
        // id kosong = mode buat baru (bukan edit); nomor dibuat otomatis saat simpan.
        id: "",
        header: {
          pelangganId: sumber.pelangganId,
          email: sumber.email ?? sumber.pelanggan.email ?? "",
          alamat: sumber.alamat ?? sumber.pelanggan.alamat ?? "",
          tanggal: todayInput(),
          jatuhTempo: toYMD(sumber.jatuhTempo),
          noRef: sumber.noRefPelanggan ?? "",
          syarat: sumber.syaratPembayaran ?? "",
          pesan: sumber.pesan ?? "",
          memo: sumber.memo ?? "",
          jenis: "HASIL_KEBUN",
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
        // Rantai dokumen: simpan id asal agar hubungan dapat ditelusuri.
        referensiIds: duplikat ? [] : [sumber.id],
        pelangganNama: sumber.pelanggan.nama,
      };
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/keuangan/penjualan"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Penjualan
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{meta.judul}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {asalLabel || meta.sub}
          {prefill && !duplikat && " · Data terbawa otomatis dari dokumen asal"}
          {prefill && duplikat && " · Salinan, ubah seperlunya sebelum disimpan"}
        </p>
      </div>
      {dokumen === "penagihan" && <PenagihanForm initial={prefill} />}
      {dokumen === "proforma" && <ProformaForm initial={prefill} />}
      {dokumen === "tukar-faktur" && <TukarFakturForm initial={prefill} />}
      {dokumen === "pesanan" && <PesananForm initial={prefill} />}
      {dokumen === "penawaran" && <PenawaranForm initial={prefill} />}
    </div>
  );
}
