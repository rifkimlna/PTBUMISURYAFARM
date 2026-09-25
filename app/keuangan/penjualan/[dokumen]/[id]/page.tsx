import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TindakanDropdown, UbahButton } from "@/components/admin/penjualan-detail";
import { formatRupiah } from "@/lib/utils";

const TIPE_BY_SLUG: Record<string, "PENAGIHAN" | "PROFORMA" | "TUKAR_FAKTUR" | "PESANAN" | "PENAWARAN"> = {
  penagihan: "PENAGIHAN",
  proforma: "PROFORMA",
  "tukar-faktur": "TUKAR_FAKTUR",
  pesanan: "PESANAN",
  penawaran: "PENAWARAN",
};

const SLUG_BY_TIPE: Record<string, string> = {
  PENAGIHAN: "penagihan",
  PROFORMA: "proforma",
  TUKAR_FAKTUR: "tukar-faktur",
  PESANAN: "pesanan",
  PENAWARAN: "penawaran",
};

const TAB_BY_TIPE: Record<string, string> = {
  PENAGIHAN: "penagihan",
  PROFORMA: "penagihan",
  TUKAR_FAKTUR: "penagihan",
  PESANAN: "pesanan",
  PENAWARAN: "penawaran",
};

const JUDUL: Record<string, { judul: string; no: string }> = {
  PENAGIHAN: { judul: "Detail Penagihan", no: "No. Invoice" },
  PROFORMA: { judul: "Detail Faktur Proforma", no: "No. Proforma" },
  TUKAR_FAKTUR: { judul: "Detail Tukar Faktur", no: "No. Tukar Faktur" },
  PESANAN: { judul: "Detail Pesanan Penjualan", no: "No. Pesanan" },
  PENAWARAN: { judul: "Detail Penawaran Penjualan", no: "No. Penawaran" },
};

function formatDate(value: Date | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Halaman Detail dokumen: informasi pesanan/penawaran/penagihan yang sudah tersimpan
// dari database, lengkap dengan Detail Produk nyata, relasi antar dokumen,
// dan tombol Tindakan (Duplikat / Buat Pengiriman / Buat Penagihan / Tutup).
export default async function DetailDokumenPage({
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
      tagihan: {
        select: {
          id: true,
          noInvoice: true,
          status: true,
          sisa: true,
          jumlah: true,
          pembayaran: {
            orderBy: { tanggal: "desc" },
            take: 20,
            select: { id: true, tanggal: true, sumberDana: true, jumlah: true, keterangan: true, kategori: true, kodeAkun: true },
          },
        },
      },
      pengiriman: {
        orderBy: { createdAt: "desc" },
        select: { id: true, noPengiriman: true, tanggalPengiriman: true, createdAt: true },
      },
    },
  });
  if (!doc || doc.tipe !== tipe) notFound();

  const [sumber, turunan] = await Promise.all([
    doc.referensiIds.length > 0
      ? prisma.dokumenPenjualan.findMany({
          where: { id: { in: doc.referensiIds } },
          select: { id: true, tipe: true, noDokumen: true, tanggal: true, total: true },
        })
      : Promise.resolve([]),
    prisma.dokumenPenjualan.findMany({
      where: { referensiIds: { has: doc.id } },
      select: { id: true, tipe: true, noDokumen: true, tanggal: true, total: true },
      orderBy: { tanggal: "desc" },
    }),
  ]);

  const meta = JUDUL[doc.tipe];
  const tab = TAB_BY_TIPE[doc.tipe];
  const tindakanKind = doc.tipe === "PESANAN" ? "PESANAN" : doc.tipe === "PENAWARAN" ? "PENAWARAN" : "PENAGIHAN";
  // Normalisasi status lama ke kosakata Mekari untuk Pesanan/Penawaran.
  const statusTampil =
    doc.tipe === "PESANAN" || doc.tipe === "PENAWARAN"
      ? doc.status === "TERBUKA" || doc.status === "PESANAN" || doc.status === "PESANAN_PROFORMA"
        ? "BELUM_DITAGIH"
        : doc.status === "DITUTUP"
          ? "SELESAI"
          : doc.status
      : doc.status;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={`/keuangan/penjualan?tab=${tab}`}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Penjualan
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {meta.judul} {doc.noDokumen}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {doc.pelanggan.nama} · Total Rp {formatRupiah(Number(doc.total))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UbahButton href={`/keuangan/penjualan/${SLUG_BY_TIPE[doc.tipe]}/${doc.id}/ubah`} />
          {(doc.tipe === "PESANAN" || doc.tipe === "PENAWARAN" || doc.tipe === "PENAGIHAN") && (
            <TindakanDropdown kind={tindakanKind} docId={doc.id} status={statusTampil} />
          )}
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base">Informasi Dokumen</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">{meta.no}</div>
            <div className="mt-0.5 text-sm font-medium">{doc.noDokumen}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Pelanggan</div>
            <div className="mt-0.5 text-sm font-medium">{doc.pelanggan.nama}</div>
            {doc.pelanggan.telepon && <div className="text-xs text-slate-500">{doc.pelanggan.telepon}</div>}
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Status</div>
            <div className="mt-0.5">
              <Badge variant="secondary" className="text-[11px]">{statusTampil}</Badge>
              {doc.tagihan && (
                <Badge
                  variant={doc.tagihan.status === "LUNAS" ? "sehat" : doc.tagihan.status === "LUNAS_SEBAGIAN" ? "info" : "warning"}
                  className="ml-1.5 text-[11px]"
                >
                  {doc.tagihan.status === "LUNAS" ? "Dibayar" : doc.tagihan.status === "LUNAS_SEBAGIAN" ? "Dibayar Sebagian" : "Menunggu Pembayaran"}
                </Badge>
              )}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Tanggal</div>
            <div className="mt-0.5 text-sm">{formatDate(doc.tanggal)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">
              {doc.tipe === "PESANAN" ? "Target / Jatuh Tempo" : doc.tipe === "PENAWARAN" ? "Kedaluwarsa" : "Jatuh Tempo"}
            </div>
            <div className="mt-0.5 text-sm">{formatDate(doc.jatuhTempo)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Total</div>
            <div className="mt-0.5 text-sm font-semibold">Rp {formatRupiah(Number(doc.total))}</div>
            {doc.tagihan && <div className="text-xs text-slate-500">Sisa Rp {formatRupiah(Number(doc.tagihan.sisa))}</div>}
          </div>
          {doc.noRefPelanggan && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">No. Referensi Pelanggan</div>
              <div className="mt-0.5 text-sm">{doc.noRefPelanggan}</div>
            </div>
          )}
          {doc.syaratPembayaran && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Syarat Pembayaran</div>
              <div className="mt-0.5 text-sm">{doc.syaratPembayaran}</div>
            </div>
          )}
          {doc.alamat && (
            <div className="sm:col-span-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Alamat</div>
              <div className="mt-0.5 text-sm text-slate-600">{doc.alamat}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base">Detail Produk</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Produk</TableHead>
                  <TableHead className="text-right">Kuantitas</TableHead>
                  <TableHead>Satuan</TableHead>
                  <TableHead className="text-right">Harga Satuan</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doc.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="text-sm">{it.deskripsi}</TableCell>
                    <TableCell className="text-right text-sm">{Number(it.kuantitas).toLocaleString("id-ID")}</TableCell>
                    <TableCell className="text-sm text-slate-500">{it.unit}</TableCell>
                    <TableCell className="text-right text-sm">Rp {formatRupiah(Number(it.harga))}</TableCell>
                    <TableCell className="text-right text-sm font-medium">Rp {formatRupiah(Number(it.jumlah))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t border-slate-100 px-5 py-3 text-right text-sm font-semibold">
            Total: Rp {formatRupiah(Number(doc.total))}
          </div>
        </CardContent>
      </Card>

      {/* Relasi antar dokumen: Penawaran → Pesanan → Pengiriman → Penagihan → Piutang */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base">Relasi Dokumen</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 text-sm">
          {sumber.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-medium text-slate-500">Dokumen Asal</div>
              <ul className="space-y-1">
                {sumber.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/keuangan/penjualan/${SLUG_BY_TIPE[s.tipe] ?? s.tipe.toLowerCase()}/${s.id}`}
                      className="text-green-700 hover:underline"
                    >
                      {s.noDokumen}
                    </Link>
                    <span className="text-xs text-slate-400"> · {s.tipe} · Rp {formatRupiah(Number(s.total))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {doc.pengiriman.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-medium text-slate-500">Pengiriman dari Pesanan ini</div>
              <ul className="space-y-1">
                {doc.pengiriman.map((p) => (
                  <li key={p.id}>
                    <Link href={`/keuangan/penjualan/pengiriman/${p.id}`} className="text-green-700 hover:underline">
                      {p.noPengiriman}
                    </Link>
                    <span className="text-xs text-slate-400"> · {formatDate(p.tanggalPengiriman ?? p.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {turunan.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-medium text-slate-500">Dokumen Turunan</div>
              <ul className="space-y-1">
                {turunan.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/keuangan/penjualan/${SLUG_BY_TIPE[t.tipe] ?? t.tipe.toLowerCase()}/${t.id}`}
                      className="text-green-700 hover:underline"
                    >
                      {t.noDokumen}
                    </Link>
                    <span className="text-xs text-slate-400"> · {t.tipe} · Rp {formatRupiah(Number(t.total))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {doc.tagihan && (
            <div>
              <div className="mb-1.5 text-xs font-medium text-slate-500">Piutang</div>
              <p className="text-slate-600">
                {doc.tagihan.noInvoice ?? doc.noDokumen} · Sisa Rp {formatRupiah(Number(doc.tagihan.sisa))} dari Rp {formatRupiah(Number(doc.tagihan.jumlah))}
              </p>
            </div>
          )}
          {sumber.length === 0 && turunan.length === 0 && doc.pengiriman.length === 0 && !doc.tagihan && (
            <p className="text-xs text-slate-400">Belum ada dokumen turunan. Gunakan tombol Tindakan untuk melanjutkan alur.</p>
          )}
          {(doc.pesan || doc.memo) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {doc.pesan && (
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-500">Pesan</div>
                  <p className="text-slate-600">{doc.pesan}</p>
                </div>
              )}
              {doc.memo && (
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-500">Memo</div>
                  <p className="text-slate-600">{doc.memo}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {doc.tagihan && doc.tagihan.pembayaran.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base">Riwayat Pembayaran</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Kas/Bank</TableHead>
                    <TableHead>Akun COA</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doc.tagihan.pembayaran.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs text-slate-500">{formatDate(p.tanggal)}</TableCell>
                      <TableCell className="text-sm">{p.sumberDana}</TableCell>
                      <TableCell className="text-xs text-slate-500">{p.kodeAkun ? `${p.kodeAkun} - ` : ""}{p.kategori}</TableCell>
                      <TableCell className="text-right text-sm">Rp {formatRupiah(Number(p.jumlah))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
