-- CreateEnum
CREATE TYPE "TipeDokumenPembelian" AS ENUM ('PERMINTAAN', 'PENAWARAN', 'PESANAN');

-- AlterTable
ALTER TABLE "faktur_pembelian" ADD COLUMN     "referensiIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "dokumen_pembelian" (
    "id" TEXT NOT NULL,
    "tipe" "TipeDokumenPembelian" NOT NULL,
    "noDokumen" TEXT NOT NULL,
    "supplierId" TEXT,
    "departemen" TEXT,
    "email" TEXT,
    "alamat" TEXT,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jatuhTempo" TIMESTAMP(3),
    "noRefSupplier" TEXT,
    "syaratPembayaran" TEXT,
    "gudang" TEXT,
    "pesan" TEXT,
    "memo" TEXT,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BELUM_DITAGIH',
    "referensiIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dokumen_pembelian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokumen_pembelian_item" (
    "id" TEXT NOT NULL,
    "dokumenId" TEXT NOT NULL,
    "produkId" TEXT,
    "deskripsi" TEXT NOT NULL,
    "kuantitas" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "harga" DECIMAL(15,2) NOT NULL,
    "diskonPersen" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "kodeAkun" TEXT,
    "jumlah" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "dokumen_pembelian_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokumen_pembelian_lampiran" (
    "id" TEXT NOT NULL,
    "dokumenId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dokumen_pembelian_lampiran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengiriman_pembelian" (
    "id" TEXT NOT NULL,
    "noPengiriman" TEXT NOT NULL,
    "pesananId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "alamatPengiriman" TEXT,
    "tanggalPengiriman" TIMESTAMP(3),
    "noTransaksi" TEXT,
    "noRefSupplier" TEXT,
    "gudang" TEXT,
    "pesan" TEXT,
    "memo" TEXT,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pengiriman_pembelian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengiriman_beli_item" (
    "id" TEXT NOT NULL,
    "pengirimanId" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "kuantitas" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "harga" DECIMAL(15,2) NOT NULL,
    "jumlah" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "pengiriman_beli_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengiriman_beli_lampiran" (
    "id" TEXT NOT NULL,
    "pengirimanId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pengiriman_beli_lampiran_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dokumen_pembelian_noDokumen_key" ON "dokumen_pembelian"("noDokumen");

-- CreateIndex
CREATE INDEX "dokumen_pembelian_tipe_idx" ON "dokumen_pembelian"("tipe");

-- CreateIndex
CREATE INDEX "dokumen_pembelian_supplierId_idx" ON "dokumen_pembelian"("supplierId");

-- CreateIndex
CREATE INDEX "dokumen_pembelian_tanggal_idx" ON "dokumen_pembelian"("tanggal");

-- CreateIndex
CREATE INDEX "dokumen_pembelian_item_dokumenId_idx" ON "dokumen_pembelian_item"("dokumenId");

-- CreateIndex
CREATE INDEX "dokumen_pembelian_lampiran_dokumenId_idx" ON "dokumen_pembelian_lampiran"("dokumenId");

-- CreateIndex
CREATE UNIQUE INDEX "pengiriman_pembelian_noPengiriman_key" ON "pengiriman_pembelian"("noPengiriman");

-- CreateIndex
CREATE INDEX "pengiriman_pembelian_pesananId_idx" ON "pengiriman_pembelian"("pesananId");

-- CreateIndex
CREATE INDEX "pengiriman_pembelian_supplierId_idx" ON "pengiriman_pembelian"("supplierId");

-- CreateIndex
CREATE INDEX "pengiriman_beli_item_pengirimanId_idx" ON "pengiriman_beli_item"("pengirimanId");

-- CreateIndex
CREATE INDEX "pengiriman_beli_lampiran_pengirimanId_idx" ON "pengiriman_beli_lampiran"("pengirimanId");

-- AddForeignKey
ALTER TABLE "dokumen_pembelian" ADD CONSTRAINT "dokumen_pembelian_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumen_pembelian" ADD CONSTRAINT "dokumen_pembelian_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumen_pembelian_item" ADD CONSTRAINT "dokumen_pembelian_item_dokumenId_fkey" FOREIGN KEY ("dokumenId") REFERENCES "dokumen_pembelian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumen_pembelian_lampiran" ADD CONSTRAINT "dokumen_pembelian_lampiran_dokumenId_fkey" FOREIGN KEY ("dokumenId") REFERENCES "dokumen_pembelian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengiriman_pembelian" ADD CONSTRAINT "pengiriman_pembelian_pesananId_fkey" FOREIGN KEY ("pesananId") REFERENCES "dokumen_pembelian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengiriman_pembelian" ADD CONSTRAINT "pengiriman_pembelian_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengiriman_pembelian" ADD CONSTRAINT "pengiriman_pembelian_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengiriman_beli_item" ADD CONSTRAINT "pengiriman_beli_item_pengirimanId_fkey" FOREIGN KEY ("pengirimanId") REFERENCES "pengiriman_pembelian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengiriman_beli_lampiran" ADD CONSTRAINT "pengiriman_beli_lampiran_pengirimanId_fkey" FOREIGN KEY ("pengirimanId") REFERENCES "pengiriman_pembelian"("id") ON DELETE CASCADE ON UPDATE CASCADE;
