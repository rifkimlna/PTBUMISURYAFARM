-- CreateEnum
CREATE TYPE "JenisKelamin" AS ENUM ('LAKI_LAKI', 'PEREMPUAN');

-- AlterTable
ALTER TABLE "karyawan" ADD COLUMN     "alamat" TEXT,
ADD COLUMN     "divisi" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "jenisKelamin" "JenisKelamin",
ADD COLUMN     "lokasiKerja" TEXT,
ADD COLUMN     "tanggalLahir" TIMESTAMP(3),
ADD COLUMN     "telepon" TEXT;

-- CreateIndex
CREATE INDEX "karyawan_divisi_idx" ON "karyawan"("divisi");

-- CreateIndex
CREATE INDEX "karyawan_lokasiKerja_idx" ON "karyawan"("lokasiKerja");
