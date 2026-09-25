export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { saldoForKontak, saldoKontakMap } from "@/lib/kontak-saldo";
import { KontakContent } from "@/components/admin/kontak-content";

// Halaman Kontak PT BST (DATA MASTER).
// Master data terpadu: Pelanggan (dipakai Penjualan), Supplier (dipakai
// Pembelian), Karyawan (internal, satu-satunya sumber data karyawan).
// Kategori Lainnya sudah dihapus dari UI; baris lama berkategori Lainnya
// (bila ada) tetap tersimpan di database tetapi tidak ditampilkan.
export default async function KontakPage() {
  const [rows, saldoMap] = await Promise.all([
    prisma.kontak.findMany({
      where: { tipe: { in: ["PELANGGAN", "SUPPLIER", "KARYAWAN"] } },
      orderBy: { nama: "asc" },
      take: 500,
    }),
    saldoKontakMap(),
  ]);

  return (
    <div className="space-y-6 min-w-0">
      <KontakContent
        data={rows.map((k) => ({
          id: k.id,
          nama: k.nama,
          tipe: k.tipe as "PELANGGAN" | "SUPPLIER" | "KARYAWAN",
          perusahaan: k.perusahaan,
          email: k.email,
          noHp: k.noHp,
          noTelepon: k.noTelepon,
          alamat: k.alamat,
          catatan: k.catatan,
          createdAt: k.createdAt.toISOString(),
          kodeKaryawan: k.kodeKaryawan,
          jabatan: k.jabatan,
          statusKerja: k.statusKerja,
          lokasiKerja: k.lokasiKerja,
          tanggalMasuk: k.tanggalMasuk?.toISOString() ?? null,
          gajiPokok: k.gajiPokok == null ? null : Number(k.gajiPokok),
          tanggalLahir: k.tanggalLahir?.toISOString() ?? null,
          jenisKelamin: k.jenisKelamin,
          saldo: saldoForKontak(saldoMap, k.tipe, k.nama),
        }))}
      />
    </div>
  );
}
