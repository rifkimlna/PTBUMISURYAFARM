import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DokumenBeliActions } from "@/components/admin/pembelian-dokumen-form";
import { formatRupiah } from "@/lib/utils";

const TIPE_VALID = ["permintaan", "penawaran", "pesanan"] as const;
const TIPE_DB: Record<string, "PERMINTAAN" | "PENAWARAN" | "PESANAN"> = {
  permintaan: "PERMINTAAN",
  penawaran: "PENAWARAN",
  pesanan: "PESANAN",
};

const JUDUL: Record<string, { judul: string; no: string; tab: string; tempo: string }> = {
  PERMINTAAN: { judul: "Detail Permintaan Pembelian", no: "No. Permintaan", tab: "permintaan", tempo: "Dibutuhkan" },
  PENAWARAN: { judul: "Detail Penawaran Pembelian", no: "No. Penawaran", tab: "penawaran", tempo: "Kedaluwarsa" },
  PESANAN: { judul: "Detail Pemesanan Pembelian", no: "No. Pesanan", tab: "pesanan", tempo: "Target / Jatuh Tempo" },
};

function formatDate(value: Date | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Halaman Detail dokumen pembelian: informasi yang sudah tersimpan dari database.
export default async function DetailDokumenBeliPage({
  params,
}: {
  params: Promise<{ tipe: string; id: string }>;
}) {
  const { tipe: slug, id } = await params;
  const tipe = TIPE_DB[slug?.toLowerCase()];
  if (!tipe || !(TIPE_VALID as readonly string[]).includes(slug?.toLowerCase())) notFound();

  const doc = await prisma.dokumenPembelian.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { orderBy: { id: "asc" } },
      lampiran: { orderBy: { createdAt: "asc" } },
      pengiriman: {
        orderBy: { createdAt: "desc" },
        select: { id: true, noPengiriman: true, tanggalPengiriman: true, createdAt: true },
      },
    },
  });
  if (!doc || doc.tipe !== tipe) notFound();

  const [sumber, turunan, fakturTerkait] = await Promise.all([
    doc.referensiIds.length > 0
      ? prisma.dokumenPembelian.findMany({
          where: { id: { in: doc.referensiIds } },
          select: { id: true, tipe: true, noDokumen: true, tanggal: true, total: true },
        })
      : Promise.resolve([]),
    prisma.dokumenPembelian.findMany({
      where: { referensiIds: { has: doc.id } },
      select: { id: true, tipe: true, noDokumen: true, tanggal: true, total: true },
      orderBy: { tanggal: "desc" },
    }),
    prisma.fakturPembelian.findMany({
      where: { referensiIds: { has: doc.id } },
      select: { id: true, noFaktur: true, tanggal: true, total: true },
      orderBy: { tanggal: "desc" },
    }),
  ]);

  const meta = JUDUL[doc.tipe];
  const slugByTipe: Record<string, string> = { PERMINTAAN: "permintaan", PENAWARAN: "penawaran", PESANAN: "pesanan" };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={`/keuangan/pembelian?tab=${meta.tab}`}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Pembelian
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {meta.judul} {doc.noDokumen}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {doc.supplier?.nama ?? doc.departemen ?? "-"} · Total Rp {formatRupiah(Number(doc.total))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/keuangan/pembelian/dokumen/${slugByTipe[doc.tipe]}/${doc.id}/ubah`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ubah
          </Link>
          <DokumenBeliActions id={doc.id} tipe={doc.tipe as "PERMINTAAN" | "PENAWARAN" | "PESANAN"} status={doc.status} />
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
            <div className="text-[11px] uppercase tracking-wide text-slate-400">{doc.supplier ? "Supplier" : "Departemen"}</div>
            <div className="mt-0.5 text-sm font-medium">{doc.supplier?.nama ?? doc.departemen ?? "-"}</div>
            {doc.supplier?.telepon && <div className="text-xs text-slate-500">{doc.supplier.telepon}</div>}
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Status</div>
            <div className="mt-0.5">
              <Badge variant={doc.status === "SELESAI" ? "sehat" : "gray"} className="text-[11px]">
                {doc.status === "SELESAI" ? "Selesai" : "Belum Ditagih"}
              </Badge>
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Tanggal</div>
            <div className="mt-0.5 text-sm">{formatDate(doc.tanggal)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">{meta.tempo}</div>
            <div className="mt-0.5 text-sm">{formatDate(doc.jatuhTempo)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Total</div>
            <div className="mt-0.5 text-sm font-semibold">Rp {formatRupiah(Number(doc.total))}</div>
          </div>
          {doc.noRefSupplier && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">No. Referensi Supplier</div>
              <div className="mt-0.5 text-sm">{doc.noRefSupplier}</div>
            </div>
          )}
          {doc.gudang && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Gudang</div>
              <div className="mt-0.5 text-sm">{doc.gudang}</div>
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
                    <Link href={`/keuangan/pembelian/dokumen/${slugByTipe[s.tipe]}/${s.id}`} className="text-green-700 hover:underline">
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
              <div className="mb-1.5 text-xs font-medium text-slate-500">Penerimaan dari Dokumen ini</div>
              <ul className="space-y-1">
                {doc.pengiriman.map((p) => (
                  <li key={p.id}>
                    <Link href={`/keuangan/pembelian/pengiriman/${p.id}`} className="text-green-700 hover:underline">
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
                    <Link href={`/keuangan/pembelian/dokumen/${slugByTipe[t.tipe]}/${t.id}`} className="text-green-700 hover:underline">
                      {t.noDokumen}
                    </Link>
                    <span className="text-xs text-slate-400"> · {t.tipe} · Rp {formatRupiah(Number(t.total))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {fakturTerkait.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-medium text-slate-500">Faktur dari Dokumen ini</div>
              <ul className="space-y-1">
                {fakturTerkait.map((f) => (
                  <li key={f.id}>
                    <Link href={`/keuangan/pembelian/faktur/${f.id}`} className="text-green-700 hover:underline">
                      {f.noFaktur}
                    </Link>
                    <span className="text-xs text-slate-400"> · Rp {formatRupiah(Number(f.total))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {sumber.length === 0 && turunan.length === 0 && doc.pengiriman.length === 0 && fakturTerkait.length === 0 && (
            <p className="text-xs text-slate-400">Belum ada dokumen turunan. Gunakan tombol Tindakan untuk melanjutkan alur.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
