import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRupiah } from "@/lib/utils";

function formatDate(value: Date | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Halaman Detail Faktur Pembelian: supplier, produk + akun COA (DEBIT),
// utang 2101, pembayaran, dan Kas/Bank — semuanya dari database.
export default async function DetailFakturPage({
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
    },
  });
  if (!faktur) notFound();

  const kodeList = [...new Set(faktur.items.map((it) => it.kodeAkun).filter(Boolean))] as string[];
  const akunDb =
    kodeList.length > 0
      ? await prisma.akunCOA.findMany({ where: { kode: { in: kodeList } }, select: { kode: true, nama: true } })
      : [];
  const namaAkun = (kode: string | null) => akunDb.find((a) => a.kode === kode)?.nama ?? "—";

  const st = faktur.tagihan?.status ?? "BELUM_LUNAS";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const telat = st !== "LUNAS" && faktur.jatuhTempo ? new Date(faktur.jatuhTempo) < now : false;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/keuangan/pembelian?tab=faktur"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Pembelian
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            Detail Faktur {faktur.noFaktur}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {faktur.supplier.nama} · Total Rp {formatRupiah(Number(faktur.total))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/keuangan/pembelian/faktur/${faktur.id}/ubah`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ubah
          </Link>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base">Informasi Faktur</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">No. Faktur</div>
            <div className="mt-0.5 text-sm font-medium">{faktur.noFaktur}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Supplier</div>
            <div className="mt-0.5 text-sm font-medium">{faktur.supplier.nama}</div>
            {faktur.supplier.telepon && <div className="text-xs text-slate-500">{faktur.supplier.telepon}</div>}
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Status</div>
            <div className="mt-0.5">
              <Badge variant={st === "LUNAS" ? "sehat" : st === "LUNAS_SEBAGIAN" ? "info" : telat ? "destructive" : "warning"} className="text-[11px]">
                {st === "LUNAS" ? "Dibayar" : st === "LUNAS_SEBAGIAN" ? "Dibayar Sebagian" : telat ? "Telat Bayar" : "Menunggu Pembayaran"}
              </Badge>
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Tanggal</div>
            <div className="mt-0.5 text-sm">{formatDate(faktur.tanggal)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Jatuh Tempo</div>
            <div className="mt-0.5 text-sm">{formatDate(faktur.jatuhTempo)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Total</div>
            <div className="mt-0.5 text-sm font-semibold">Rp {formatRupiah(Number(faktur.total))}</div>
            {faktur.tagihan && <div className="text-xs text-slate-500">Sisa Rp {formatRupiah(Number(faktur.tagihan.sisa))}</div>}
          </div>
          {faktur.noRefSupplier && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">No. Referensi Supplier</div>
              <div className="mt-0.5 text-sm">{faktur.noRefSupplier}</div>
            </div>
          )}
          {faktur.syaratPembayaran && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Syarat Pembayaran</div>
              <div className="mt-0.5 text-sm">{faktur.syaratPembayaran}</div>
            </div>
          )}
          {faktur.gudang && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Gudang</div>
              <div className="mt-0.5 text-sm">{faktur.gudang}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base">Detail Produk & Akun COA</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk / Deskripsi</TableHead>
                  <TableHead className="text-right">Kuantitas</TableHead>
                  <TableHead>Satuan</TableHead>
                  <TableHead className="text-right">Harga Satuan</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead>Akun COA (DEBIT)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faktur.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="text-sm">{it.deskripsi}</TableCell>
                    <TableCell className="text-right text-sm">{Number(it.kuantitas).toLocaleString("id-ID")}</TableCell>
                    <TableCell className="text-sm text-slate-500">{it.unit}</TableCell>
                    <TableCell className="text-right text-sm">Rp {formatRupiah(Number(it.harga))}</TableCell>
                    <TableCell className="text-right text-sm font-medium">Rp {formatRupiah(Number(it.jumlah))}</TableCell>
                    <TableCell className="text-xs text-slate-600">{it.kodeAkun ? `${it.kodeAkun} - ${namaAkun(it.kodeAkun)}` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t border-slate-100 px-5 py-3 text-right text-sm font-semibold">
            Total: Rp {formatRupiah(Number(faktur.total))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base">Utang & Pembayaran</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 text-sm">
          {faktur.tagihan ? (
            <>
              <p className="text-slate-600">
                2101 - Utang Usaha · Sisa Rp {formatRupiah(Number(faktur.tagihan.sisa))} dari Rp {formatRupiah(Number(faktur.tagihan.jumlah))}
              </p>
              {faktur.tagihan.status !== "LUNAS" && (
                <p className="text-xs text-slate-500">
                  Pembayaran supplier dicatat di{" "}
                  <Link href="/keuangan/tagihan" className="font-medium text-green-700 hover:underline">
                    Hutang & Piutang
                  </Link>{" "}
                  (mengurangi 2101 - Utang Usaha dan Kas/Bank, tanpa mencatat pembelian lagi).
                </p>
              )}
              {faktur.tagihan.pembayaran.length > 0 ? (                <div className="overflow-x-auto rounded-lg border border-slate-100">
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
                      {faktur.tagihan.pembayaran.map((p) => (
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
              ) : (
                <p className="text-xs text-slate-400">Belum ada pembayaran. Kas/Bank tidak berkurang sampai supplier dibayar.</p>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-400">Tidak ada utang tertaut.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
