import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { labelSumberDana } from "@/lib/coa";
import { formatRupiah } from "@/lib/utils";

const AKUN_MAP: Record<string, { sumber: "KAS" | "BANK" | "TABUNGAN"; kode: string; nama: string }> = {
  kas: { sumber: "KAS", kode: "1101", nama: "Kas" },
  bank: { sumber: "BANK", kode: "1103", nama: "Bank" },
  tabungan: { sumber: "TABUNGAN", kode: "1104", nama: "Tabungan" },
};

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function DetailAkunPage({ params }: { params: Promise<{ akun: string }> }) {
  const { akun } = await params;
  const meta = AKUN_MAP[akun?.toLowerCase()];
  if (!meta) notFound();

  const whereRelasi = {
    OR: [{ sumberDana: meta.sumber }, { sumberDanaTujuan: meta.sumber }],
  };

  const [transaksi, aggSumber, aggTujuan] = await Promise.all([
    prisma.transaksiKas.findMany({
      where: whereRelasi,
      orderBy: { tanggal: "desc" },
      take: 100,
      include: { _count: { select: { bukti: true } } },
    }),
    prisma.transaksiKas.groupBy({
      by: ["tipe"],
      where: { sumberDana: meta.sumber },
      _sum: { jumlah: true },
      _count: { id: true },
    }),
    prisma.transaksiKas.groupBy({
      by: ["tipe"],
      where: { sumberDanaTujuan: meta.sumber },
      _sum: { jumlah: true },
      _count: { id: true },
    }),
  ]);

  const sum = (rows: typeof aggSumber, tipe: string) =>
    Number(rows.find((r) => r.tipe === tipe)?._sum.jumlah ?? 0);
  const count = (rows: typeof aggSumber, tipe: string) =>
    rows.find((r) => r.tipe === tipe)?._count.id ?? 0;

  const uangMasuk = sum(aggSumber, "PEMASUKAN");
  const uangKeluar = sum(aggSumber, "PENGELUARAN");
  const transferKeluar = sum(aggSumber, "TRANSFER");
  const transferMasuk = sum(aggTujuan, "TRANSFER");
  const saldo = uangMasuk - uangKeluar - transferKeluar + transferMasuk;
  const totalTransaksi =
    count(aggSumber, "PEMASUKAN") +
    count(aggSumber, "PENGELUARAN") +
    count(aggSumber, "TRANSFER") +
    count(aggTujuan, "TRANSFER");

  const stats = [
    { label: "Uang Masuk", value: uangMasuk, tone: "text-green-700" },
    { label: "Uang Keluar", value: uangKeluar, tone: "text-red-600" },
    { label: "Transfer Masuk", value: transferMasuk, tone: "text-green-700" },
    { label: "Transfer Keluar", value: transferKeluar, tone: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/keuangan/kas"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Kas & Bank
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Detail Akun {meta.kode} - {meta.nama}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {totalTransaksi} transaksi tercatat
        </p>
      </div>

      <Card className="border-slate-200 bg-slate-900 text-white">
        <CardContent className="p-6">
          <p className="text-xs font-medium tracking-wide text-slate-400">SALDO {meta.nama.toUpperCase()} SAAT INI</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">Rp {formatRupiah(saldo)}</p>
          <p className="mt-1 text-xs text-slate-400">
            Masuk Rp {formatRupiah(uangMasuk + transferMasuk)} · Keluar Rp{" "}
            {formatRupiah(uangKeluar + transferKeluar)}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-slate-100">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={`mt-1 text-lg font-semibold tracking-tight ${s.tone}`}>
                Rp {formatRupiah(s.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>No Transaksi</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Kategori / Keterangan</TableHead>
                  <TableHead className="text-right">Mutasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transaksi.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                      Belum ada transaksi untuk akun {meta.nama}
                    </TableCell>
                  </TableRow>
                ) : (
                  transaksi.map((t) => {
                    const isTransfer = t.tipe === "TRANSFER";
                    const isMasuk = t.tipe === "PEMASUKAN" || (isTransfer && t.sumberDanaTujuan === meta.sumber);
                    const arah = isTransfer
                      ? isMasuk
                        ? `dari ${labelSumberDana(t.sumberDana)}`
                        : `ke ${labelSumberDana(t.sumberDanaTujuan)}`
                      : labelSumberDana(t.sumberDana);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs text-slate-500">{formatDate(t.tanggal)}</TableCell>
                        <TableCell className="text-xs text-slate-500">{t.noTransaksi || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={t.tipe === "PEMASUKAN" ? "sehat" : "outline"} className="text-[11px]">
                            {t.tipe}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-slate-700">{t.kodeAkun ? `${t.kodeAkun} - ` : ""}{t.kategori}</div>
                          <div className="text-[11px] text-slate-400">
                            {[t.pihak, t.deskripsi || t.keterangan, arah].filter(Boolean).join(" · ")}
                            {(t._count.bukti ?? 0) > 0 && ` · ${t._count.bukti} lampiran`}
                          </div>
                        </TableCell>
                        <TableCell
                          className={`text-right text-sm font-medium tracking-tight ${
                            isMasuk ? "text-green-700" : "text-red-600"
                          }`}
                        >
                          {isMasuk ? "+" : "−"} Rp {formatRupiah(Number(t.jumlah))}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
