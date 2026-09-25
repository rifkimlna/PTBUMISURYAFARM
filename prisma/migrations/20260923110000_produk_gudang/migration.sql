-- AlterTable
ALTER TABLE "persediaan_barang" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "batasMinimum" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hargaBeli" DECIMAL(15,2),
ADD COLUMN     "hargaJual" DECIMAL(15,2),
ADD COLUMN     "tipeProduk" TEXT;

-- AlterTable
ALTER TABLE "riwayat_stok" ADD COLUMN     "sumber" TEXT;

-- CreateTable
CREATE TABLE "gudang" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "alamat" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gudang_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gudang_kode_key" ON "gudang"("kode");

-- CreateIndex
CREATE INDEX "gudang_status_idx" ON "gudang"("status");

-- CreateIndex
CREATE UNIQUE INDEX "persediaan_barang_barcode_key" ON "persediaan_barang"("barcode");
