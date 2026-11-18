-- CreateEnum
CREATE TYPE "TipeLowongan" AS ENUM ('KERJA', 'MAGANG');

-- CreateEnum
CREATE TYPE "StatusPelamar" AS ENUM ('BARU', 'SELEKSI', 'INTERVIEW', 'DITERIMA', 'DITOLAK');

-- CreateTable
CREATE TABLE "lowongan" (
    "id" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "divisi" TEXT NOT NULL,
    "lokasi" TEXT NOT NULL,
    "tipe" "TipeLowongan" NOT NULL DEFAULT 'KERJA',
    "deskripsi" TEXT NOT NULL,
    "kualifikasi" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lowongan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pelamar" (
    "id" TEXT NOT NULL,
    "lowonganId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "wa" TEXT NOT NULL,
    "cvUrl" TEXT NOT NULL,
    "tipe" "TipeLowongan" NOT NULL DEFAULT 'KERJA',
    "status" "StatusPelamar" NOT NULL DEFAULT 'BARU',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pelamar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lowongan_isActive_idx" ON "lowongan"("isActive");

-- CreateIndex
CREATE INDEX "pelamar_lowonganId_idx" ON "pelamar"("lowonganId");

-- CreateIndex
CREATE INDEX "pelamar_status_idx" ON "pelamar"("status");

-- AddForeignKey
ALTER TABLE "pelamar" ADD CONSTRAINT "pelamar_lowonganId_fkey" FOREIGN KEY ("lowonganId") REFERENCES "lowongan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
