-- CreateEnum
CREATE TYPE "JenisStok" AS ENUM ('MASUK', 'KELUAR');

-- CreateTable
CREATE TABLE "persediaan_barang" (
    "id" TEXT NOT NULL,
    "namaBarang" TEXT NOT NULL,
    "kategori" TEXT NOT NULL,
    "stokAwal" INTEGER NOT NULL DEFAULT 0,
    "satuan" TEXT NOT NULL,
    "hargaSatuan" DECIMAL(15,2) NOT NULL,
    "keterangan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persediaan_barang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riwayat_stok" (
    "id" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "jenis" "JenisStok" NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "keterangan" TEXT,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riwayat_stok_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "persediaan_barang_kategori_idx" ON "persediaan_barang"("kategori");

-- CreateIndex
CREATE INDEX "riwayat_stok_barangId_idx" ON "riwayat_stok"("barangId");

-- CreateIndex
CREATE INDEX "riwayat_stok_tanggal_idx" ON "riwayat_stok"("tanggal");

-- AddForeignKey
ALTER TABLE "riwayat_stok" ADD CONSTRAINT "riwayat_stok_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "persediaan_barang"("id") ON DELETE CASCADE ON UPDATE CASCADE;
