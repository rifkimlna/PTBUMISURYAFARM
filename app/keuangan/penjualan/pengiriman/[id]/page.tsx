import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatDate(value: Date | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Detail Pengiriman: terhubung ke Pesanan asal, tanpa transaksi keuangan.
export default async function DetailPengirimanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await prisma.pengirimanPenjualan.findUnique({
    where: { id },
    include: {
      pelanggan: true,
      pesanan: { select: { id: true, noDokumen: true, tanggal: true, total: true, status: true } },
      items: { orderBy: { id: "asc" } },
      lampiran: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/keuangan/penjualan?tab=pengiriman"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Pengiriman
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Detail Pengiriman {data.noPengiriman}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Dari Pesanan{" "}
          <Link href={`/keuangan/penjualan/pesanan/${data.pesanan.id}`} className="text-green-700 hover:underline">
            {data.pesanan.noDokumen}
          </Link>{" "}
          · {data.pelanggan.nama}
        </p>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base">Informasi Pengiriman</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">No. Pengiriman</div>
            <div className="mt-0.5 text-sm font-medium">{data.noPengiriman}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Pelanggan</div>
            <div className="mt-0.5 text-sm font-medium">{data.pelanggan.nama}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Tgl. Pengiriman</div>
            <div className="mt-0.5 text-sm">{formatDate(data.tanggalPengiriman ?? data.createdAt)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Nomor Pesanan</div>
            <div className="mt-0.5 text-sm">{data.pesanan.noDokumen}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Kirim Melalui</div>
            <div className="mt-0.5 text-sm">{data.kirimMelalui || "—"}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">No. Pelacakan</div>
            <div className="mt-0.5 text-sm">{data.noPelacakan || "—"}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Gudang</div>
            <div className="mt-0.5 text-sm">{data.gudang || "—"}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">No. Referensi Pelanggan</div>
            <div className="mt-0.5 text-sm">{data.noRefPelanggan || "—"}</div>
          </div>
          {data.alamatPengiriman && (
            <div className="sm:col-span-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Alamat Pengiriman</div>
              <div className="mt-0.5 text-sm text-slate-600">{data.alamatPengiriman}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base">Produk Dikirim</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Kuantitas</TableHead>
                  <TableHead>Unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="text-sm">{it.deskripsi}</TableCell>
                    <TableCell className="text-right text-sm">{Number(it.kuantitas).toLocaleString("id-ID")}</TableCell>
                    <TableCell className="text-sm text-slate-500">{it.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
            Pengiriman tidak mencatat pemasukan — piutang baru terbentuk saat dibuat Penagihan.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
