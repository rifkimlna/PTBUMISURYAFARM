-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN_PERTANIAN', 'ADMIN_KEUANGAN');

-- CreateEnum
CREATE TYPE "StatusKesehatan" AS ENUM ('SEHAT', 'PERLU_PERHATIAN', 'SAKIT', 'MATI');

-- CreateEnum
CREATE TYPE "StatusKaryawan" AS ENUM ('TETAP', 'KONTRAK', 'HARIAN');

-- CreateEnum
CREATE TYPE "StatusGaji" AS ENUM ('SUDAH_DIBAYAR', 'PENDING');

-- CreateEnum
CREATE TYPE "TipeTransaksi" AS ENUM ('PEMASUKAN', 'PENGELUARAN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN_PERTANIAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pohon" (
    "id" TEXT NOT NULL,
    "varietas" TEXT NOT NULL,
    "lokasiBlok" TEXT NOT NULL,
    "tanggalTanam" TIMESTAMP(3) NOT NULL,
    "status" "StatusKesehatan" NOT NULL DEFAULT 'SEHAT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pohon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riwayat_kesehatan" (
    "id" TEXT NOT NULL,
    "pohonId" TEXT NOT NULL,
    "gejala" TEXT NOT NULL,
    "tindakan" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "tanggalCek" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "petugasId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riwayat_kesehatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "karyawan" (
    "id" TEXT NOT NULL,
    "namaLengkap" TEXT NOT NULL,
    "jabatan" TEXT NOT NULL,
    "statusKerja" "StatusKaryawan" NOT NULL,
    "gajiPokok" DECIMAL(15,2) NOT NULL,
    "tanggalMasuk" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "karyawan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riwayat_gaji" (
    "id" TEXT NOT NULL,
    "karyawanId" TEXT NOT NULL,
    "bulanTahun" TEXT NOT NULL,
    "totalGaji" DECIMAL(15,2) NOT NULL,
    "status" "StatusGaji" NOT NULL DEFAULT 'PENDING',
    "tanggalBayar" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "riwayat_gaji_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aset" (
    "id" TEXT NOT NULL,
    "namaAset" TEXT NOT NULL,
    "jumlah" INTEGER NOT NULL DEFAULT 1,
    "kondisi" TEXT NOT NULL,
    "nilaiAset" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaksi_kas" (
    "id" TEXT NOT NULL,
    "tipe" "TipeTransaksi" NOT NULL,
    "kategori" TEXT NOT NULL,
    "jumlah" DECIMAL(15,2) NOT NULL,
    "keterangan" TEXT,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaksi_kas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "pohon_lokasiBlok_idx" ON "pohon"("lokasiBlok");

-- CreateIndex
CREATE INDEX "pohon_status_idx" ON "pohon"("status");

-- CreateIndex
CREATE INDEX "riwayat_kesehatan_pohonId_idx" ON "riwayat_kesehatan"("pohonId");

-- CreateIndex
CREATE INDEX "riwayat_kesehatan_petugasId_idx" ON "riwayat_kesehatan"("petugasId");

-- CreateIndex
CREATE INDEX "riwayat_kesehatan_tanggalCek_idx" ON "riwayat_kesehatan"("tanggalCek");

-- CreateIndex
CREATE INDEX "karyawan_statusKerja_idx" ON "karyawan"("statusKerja");

-- CreateIndex
CREATE INDEX "riwayat_gaji_status_idx" ON "riwayat_gaji"("status");

-- CreateIndex
CREATE UNIQUE INDEX "riwayat_gaji_karyawanId_bulanTahun_key" ON "riwayat_gaji"("karyawanId", "bulanTahun");

-- CreateIndex
CREATE INDEX "transaksi_kas_tipe_idx" ON "transaksi_kas"("tipe");

-- CreateIndex
CREATE INDEX "transaksi_kas_kategori_idx" ON "transaksi_kas"("kategori");

-- CreateIndex
CREATE INDEX "transaksi_kas_tanggal_idx" ON "transaksi_kas"("tanggal");

-- CreateIndex
CREATE INDEX "transaksi_kas_adminId_idx" ON "transaksi_kas"("adminId");

-- AddForeignKey
ALTER TABLE "riwayat_kesehatan" ADD CONSTRAINT "riwayat_kesehatan_pohonId_fkey" FOREIGN KEY ("pohonId") REFERENCES "pohon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_kesehatan" ADD CONSTRAINT "riwayat_kesehatan_petugasId_fkey" FOREIGN KEY ("petugasId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_gaji" ADD CONSTRAINT "riwayat_gaji_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "karyawan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaksi_kas" ADD CONSTRAINT "transaksi_kas_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
