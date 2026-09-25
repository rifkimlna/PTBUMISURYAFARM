-- CreateEnum
CREATE TYPE "TipeKontak" AS ENUM ('PELANGGAN', 'SUPPLIER', 'KARYAWAN', 'LAINNYA');

-- CreateTable
CREATE TABLE "kontak" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tipe" "TipeKontak" NOT NULL,
    "perusahaan" TEXT,
    "email" TEXT,
    "noHp" TEXT,
    "noTelepon" TEXT,
    "alamat" TEXT,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kontak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kontak_tipe_idx" ON "kontak"("tipe");

-- CreateIndex
CREATE INDEX "kontak_nama_idx" ON "kontak"("nama");
