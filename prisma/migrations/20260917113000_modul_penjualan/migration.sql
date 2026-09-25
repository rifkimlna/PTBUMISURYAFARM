-- CreateEnum
CREATE TYPE "TipeDokumenPenjualan" AS ENUM ('PENAWARAN', 'PESANAN', 'PROFORMA', 'TUKAR_FAKTUR', 'PENAGIHAN');

-- CreateTable
CREATE TABLE "pelanggan" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT,
    "telepon" TEXT,
    "alamat" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pelanggan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokumen_penjualan" (
    "id" TEXT NOT NULL,
    "tipe" "TipeDokumenPenjualan" NOT NULL,
    "noDokumen" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "email" TEXT,
    "alamat" TEXT,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jatuhTempo" TIMESTAMP(3),
    "noRefPelanggan" TEXT,
    "syaratPembayaran" TEXT,
    "pesan" TEXT,
    "memo" TEXT,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TERBUKA',
    "referensiIds" TEXT[] NOT NULL DEFAULT '{}',
    "tagihanId" TEXT,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dokumen_penjualan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokumen_penjualan_item" (
    "id" TEXT NOT NULL,
    "dokumenId" TEXT NOT NULL,
    "produkId" TEXT,
    "deskripsi" TEXT NOT NULL,
    "kuantitas" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "harga" DECIMAL(15,2) NOT NULL,
    "diskonPersen" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "jumlah" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "dokumen_penjualan_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokumen_penjualan_lampiran" (
    "id" TEXT NOT NULL,
    "dokumenId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dokumen_penjualan_lampiran_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dokumen_penjualan_noDokumen_key" ON "dokumen_penjualan"("noDokumen");

-- CreateIndex
CREATE UNIQUE INDEX "dokumen_penjualan_tagihanId_key" ON "dokumen_penjualan"("tagihanId");

-- CreateIndex
CREATE INDEX "pelanggan_nama_idx" ON "pelanggan"("nama");

-- CreateIndex
CREATE INDEX "dokumen_penjualan_tipe_idx" ON "dokumen_penjualan"("tipe");

-- CreateIndex
CREATE INDEX "dokumen_penjualan_pelangganId_idx" ON "dokumen_penjualan"("pelangganId");

-- CreateIndex
CREATE INDEX "dokumen_penjualan_tanggal_idx" ON "dokumen_penjualan"("tanggal");

-- CreateIndex
CREATE INDEX "dokumen_penjualan_tagihanId_idx" ON "dokumen_penjualan"("tagihanId");

-- CreateIndex
CREATE INDEX "dokumen_penjualan_item_dokumenId_idx" ON "dokumen_penjualan_item"("dokumenId");

-- CreateIndex
CREATE INDEX "dokumen_penjualan_lampiran_dokumenId_idx" ON "dokumen_penjualan_lampiran"("dokumenId");

-- AddForeignKey
ALTER TABLE "dokumen_penjualan" ADD CONSTRAINT "dokumen_penjualan_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "pelanggan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumen_penjualan" ADD CONSTRAINT "dokumen_penjualan_tagihanId_fkey" FOREIGN KEY ("tagihanId") REFERENCES "tagihan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumen_penjualan" ADD CONSTRAINT "dokumen_penjualan_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumen_penjualan_item" ADD CONSTRAINT "dokumen_penjualan_item_dokumenId_fkey" FOREIGN KEY ("dokumenId") REFERENCES "dokumen_penjualan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumen_penjualan_lampiran" ADD CONSTRAINT "dokumen_penjualan_lampiran_dokumenId_fkey" FOREIGN KEY ("dokumenId") REFERENCES "dokumen_penjualan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
