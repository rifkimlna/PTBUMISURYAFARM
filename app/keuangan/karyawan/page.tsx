import { prisma } from "@/lib/prisma";
import { KaryawanTable } from "@/components/admin/karyawan-table";

export default async function DataKaryawanPage() {
  const karyawan = await prisma.karyawan.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      riwayatGaji: {
        orderBy: { bulanTahun: "desc" },
        take: 1,
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Data Karyawan</h1>
          <p className="mt-1 text-sm text-slate-500">{karyawan.length} karyawan terdata • Kelola profil, kontak, dan penempatan kerja</p>
        </div>
      </div>
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
          bulanGaji: k.riwayatGaji[0]?.bulanTahun ?? "",
          statusGaji: k.riwayatGaji[0]?.status ?? "PENDING",
        }))}
      />
    </div>
  );
}
