import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { ExportButton } from "@/components/admin/print-button";
import { KaryawanTable } from "@/components/admin/karyawan-table";
import { TransaksiTable } from "@/components/admin/transaksi-table";
import { AsetTable } from "@/components/admin/aset-table";

export default async function KeuanganPage() {
  const [transaksi, karyawan, aset, agg, totalTransaksi, cookieStore] = await Promise.all([
    prisma.transaksiKas.findMany({ orderBy: { tanggal: "desc" }, take: 10, include: { admin: { select: { nama: true } } } }),
    prisma.karyawan.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { riwayatGaji: { orderBy: { bulanTahun: "desc" }, take: 1 } } }),
    prisma.aset.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.transaksiKas.groupBy({ by: ["tipe"], _sum: { jumlah: true } }),
    prisma.transaksiKas.count(),
    cookies(),
  ]);

  const token = cookieStore.get("token")?.value;
  const session = token ? await verifyToken(token) : null;
  const canDelete = session?.role === "SUPER_ADMIN";

  const pemasukan = Number(agg.find((a) => a.tipe === "PEMASUKAN")?._sum.jumlah ?? 0);
  const pengeluaran = Number(agg.find((a) => a.tipe === "PENGELUARAN")?._sum.jumlah ?? 0);
  const saldo = pemasukan - pengeluaran;

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
            Keuangan <span className="font-semibold">overview</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Kas • Karyawan • Aset — minimal, real-time</p>
        </div>
        <div className="shrink-0"><ExportButton /></div>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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

      <TransaksiTable
        initialData={transaksi.map((t) => ({
          id: t.id,
          tanggal: t.tanggal.toISOString(),
          tipe: t.tipe,
          kategori: t.kategori,
          jumlah: Number(t.jumlah),
          keterangan: t.keterangan,
          admin: { nama: t.admin.nama },
        }))}
        initialTotal={totalTransaksi}
        canDelete={canDelete}
      />

      <KaryawanTable
        data={karyawan.map((k) => ({
          id: k.id,
          namaLengkap: k.namaLengkap,
          jabatan: k.jabatan,
          statusKerja: k.statusKerja,
          gajiPokok: Number(k.gajiPokok),
          tanggalMasuk: k.tanggalMasuk.toISOString(),
          telepon: k.telepon ?? "",
          email: k.email ?? "",
          alamat: k.alamat ?? "",
          tanggalLahir: k.tanggalLahir?.toISOString() ?? "",
          jenisKelamin: k.jenisKelamin ?? "",
          divisi: k.divisi ?? "",
          lokasiKerja: k.lokasiKerja ?? "",
          bulanGaji: k.riwayatGaji[0]?.bulanTahun || "",
          statusGaji: k.riwayatGaji[0]?.status ?? "PENDING",
        }))}
      />

      <AsetTable
        initialData={aset.map((a) => ({
          id: a.id,
          namaAset: a.namaAset,
          jumlah: a.jumlah,
          kondisi: a.kondisi,
          nilaiAset: Number(a.nilaiAset),
        }))}
        canDelete={canDelete}
      />
    </div>
  );
}