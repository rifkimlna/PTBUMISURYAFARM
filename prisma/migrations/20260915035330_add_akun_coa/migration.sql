-- CreateEnum
CREATE TYPE "KelompokCOA" AS ENUM ('Aset', 'Kewajiban', 'Modal', 'Pendapatan', 'Beban');

-- CreateEnum
CREATE TYPE "TipeAkunCOA" AS ENUM ('PEMASUKAN', 'PENGELUARAN', 'NETRAL');

-- CreateTable
CREATE TABLE "akun_coa" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kelompok" "KelompokCOA" NOT NULL,
    "golongan" TEXT NOT NULL,
    "tipe" "TipeAkunCOA" NOT NULL,
    "deskripsi" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "akun_coa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "akun_coa_kode_key" ON "akun_coa"("kode");

-- CreateIndex
CREATE INDEX "akun_coa_kelompok_idx" ON "akun_coa"("kelompok");

-- CreateIndex
CREATE INDEX "akun_coa_golongan_idx" ON "akun_coa"("golongan");

-- CreateIndex
CREATE INDEX "akun_coa_kode_idx" ON "akun_coa"("kode");

-- AddForeignKey
ALTER TABLE "akun_coa" ADD CONSTRAINT "akun_coa_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
