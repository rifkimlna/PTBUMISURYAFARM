-- CreateTable
CREATE TABLE "pengiriman_penjualan" (
    "id" TEXT NOT NULL,
    "noPengiriman" TEXT NOT NULL,
    "pesananId" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "alamatPengiriman" TEXT,
    "tanggalPengiriman" TIMESTAMP(3),
    "noTransaksi" TEXT,
    "noRefPelanggan" TEXT,
    "kirimMelalui" TEXT,
    "noPelacakan" TEXT,
    "gudang" TEXT,
    "pesan" TEXT,
    "memo" TEXT,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pengiriman_penjualan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengiriman_item" (
    "id" TEXT NOT NULL,
    "pengirimanId" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "kuantitas" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "harga" DECIMAL(15,2) NOT NULL,
    "jumlah" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "pengiriman_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengiriman_lampiran" (
    "id" TEXT NOT NULL,
    "pengirimanId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pengiriman_lampiran_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pengiriman_penjualan_noPengiriman_key" ON "pengiriman_penjualan"("noPengiriman");

-- CreateIndex
CREATE INDEX "pengiriman_penjualan_pesananId_idx" ON "pengiriman_penjualan"("pesananId");

-- CreateIndex
CREATE INDEX "pengiriman_penjualan_pelangganId_idx" ON "pengiriman_penjualan"("pelangganId");

-- CreateIndex
CREATE INDEX "pengiriman_item_pengirimanId_idx" ON "pengiriman_item"("pengirimanId");

-- CreateIndex
CREATE INDEX "pengiriman_lampiran_pengirimanId_idx" ON "pengiriman_lampiran"("pengirimanId");

-- AddForeignKey
ALTER TABLE "pengiriman_penjualan" ADD CONSTRAINT "pengiriman_penjualan_pesananId_fkey" FOREIGN KEY ("pesananId") REFERENCES "dokumen_penjualan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengiriman_penjualan" ADD CONSTRAINT "pengiriman_penjualan_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "pelanggan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengiriman_penjualan" ADD CONSTRAINT "pengiriman_penjualan_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengiriman_item" ADD CONSTRAINT "pengiriman_item_pengirimanId_fkey" FOREIGN KEY ("pengirimanId") REFERENCES "pengiriman_penjualan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengiriman_lampiran" ADD CONSTRAINT "pengiriman_lampiran_pengirimanId_fkey" FOREIGN KEY ("pengirimanId") REFERENCES "pengiriman_penjualan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
