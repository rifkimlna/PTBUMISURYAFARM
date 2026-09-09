import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/admin/print-button";
import { KaryawanTable } from "@/components/admin/karyawan-table";

export default async function KeuanganPage() {
  const [transaksi, karyawan, aset, agg] = await Promise.all([
    prisma.transaksiKas.findMany({ orderBy: { tanggal: "desc" }, take: 20, include: { admin: { select: { nama: true } } } }),
    prisma.karyawan.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { riwayatGaji: { orderBy: { bulanTahun: "desc" }, take: 1 } } }),
    prisma.aset.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.transaksiKas.groupBy({ by: ["tipe"], _sum: { jumlah: true } }),
  ]);

  const pemasukan = Number(agg.find((a) => a.tipe === "PEMASUKAN")?._sum.jumlah ?? 0);
  const pengeluaran = Number(agg.find((a) => a.tipe === "PENGELUARAN")?._sum.jumlah ?? 0);
  const saldo = pemasukan - pengeluaran;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Keuangan <span className="font-semibold">overview</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Kas • Karyawan • Aset — minimal, real-time</p>
        </div>
        <ExportButton />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { label: "Pemasukan", value: pemasukan, note: "PEMASUKAN" },
          { label: "Pengeluaran", value: pengeluaran, note: "PENGELUARAN", tone: "text-slate-500" },
          { label: "Saldo", value: saldo, note: "Pemasukan − Pengeluaran", tone: saldo < 0 ? "text-red-500" : "text-slate-900" },
        ].map((c) => (
          <Card key={c.label} className="border-slate-100">
            <CardContent className="p-5">
              <div className="text-xs tracking-wide text-slate-400">{c.label}</div>
              <div className={`mt-2 text-2xl font-semibold tracking-tight ${c.tone || "text-slate-900"}`}>Rp {c.value.toLocaleString("id-ID")}</div>
              <div className="mt-1 text-xs text-slate-400">{c.note}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-50 px-6 py-4">
          <div className="text-sm font-medium tracking-tight">Transaksi Terbaru</div>
          <div className="text-xs text-slate-400">{transaksi.length} entri</div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-slate-50 hover:bg-transparent">
              <TableHead className="text-xs tracking-wide text-slate-400">Tanggal</TableHead>
              <TableHead className="text-xs tracking-wide text-slate-400">Tipe</TableHead>
              <TableHead className="text-xs tracking-wide text-slate-400">Kategori</TableHead>
              <TableHead className="text-xs tracking-wide text-slate-400">Jumlah</TableHead>
              <TableHead className="text-xs tracking-wide text-slate-400">Admin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transaksi.map((t) => (
              <TableRow key={t.id} className="border-slate-50">
                <TableCell className="text-xs text-slate-500">{new Date(t.tanggal).toLocaleDateString("id-ID")}</TableCell>
                <TableCell>
                  <Badge variant={t.tipe === "PEMASUKAN" ? "sehat" : "outline"} className="text-[11px]">
                    {t.tipe}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-slate-700">{t.kategori}</TableCell>
                <TableCell className="text-sm font-medium tracking-tight">Rp {Number(t.jumlah).toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-xs text-slate-500">{t.admin.nama}</TableCell>
              </TableRow>
            ))}
            {transaksi.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-slate-400">
                  Belum ada transaksi
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <KaryawanTable
        data={karyawan.map((k) => ({
          id: k.id,
          namaLengkap: k.namaLengkap,
          jabatan: k.jabatan,
          statusKerja: k.statusKerja as string,
          gajiPokok: Number(k.gajiPokok),
          bulanGaji: k.riwayatGaji[0]?.bulanTahun || "-",
          statusGaji: (k.riwayatGaji[0]?.status as string) || "PENDING",
        }))}
      />

      <Card className="overflow-hidden border-slate-100">
        <div className="border-b border-slate-50 px-6 py-4 text-sm font-medium tracking-tight">Inventaris Aset</div>
        <Table>
          <TableHeader>
            <TableRow className="border-slate-50">
              <TableHead className="text-xs tracking-wide text-slate-400">ID</TableHead>
              <TableHead className="text-xs tracking-wide text-slate-400">Nama</TableHead>
              <TableHead className="text-xs tracking-wide text-slate-400">Jumlah</TableHead>
              <TableHead className="text-xs tracking-wide text-slate-400">Kondisi</TableHead>
              <TableHead className="text-xs tracking-wide text-slate-400">Nilai</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aset.map((a) => (
              <TableRow key={a.id} className="border-slate-50">
                <TableCell className="font-mono text-xs tracking-tight">{a.id}</TableCell>
                <TableCell className="text-sm">{a.namaAset}</TableCell>
                <TableCell className="text-sm text-slate-500">{a.jumlah}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {a.kondisi}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">Rp {Number(a.nilaiAset).toLocaleString("id-ID")}</TableCell>
              </TableRow>
            ))}
            {aset.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-slate-400">
                  Belum ada aset
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
