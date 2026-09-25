-- AlterTable
ALTER TABLE "kontak" ADD COLUMN     "gajiPokok" DECIMAL(15,2),
ADD COLUMN     "jabatan" TEXT,
ADD COLUMN     "jenisKelamin" "JenisKelamin",
ADD COLUMN     "kodeKaryawan" TEXT,
ADD COLUMN     "lokasiKerja" TEXT,
ADD COLUMN     "statusKerja" "StatusKaryawan",
ADD COLUMN     "tanggalLahir" TIMESTAMP(3),
ADD COLUMN     "tanggalMasuk" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "kontak_kodeKaryawan_key" ON "kontak"("kodeKaryawan");
