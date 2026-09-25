-- CreateTable
CREATE TABLE "supplier" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT,
    "telepon" TEXT,
    "alamat" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faktur_pembelian" (
    "id" TEXT NOT NULL,
    "noFaktur" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "email" TEXT,
    "alamat" TEXT,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jatuhTempo" TIMESTAMP(3),
    "noRefSupplier" TEXT,
    "syaratPembayaran" TEXT,
    "gudang" TEXT,
    "tag" TEXT,
    "pesan" TEXT,
    "memo" TEXT,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "tagihanId" TEXT,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faktur_pembelian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faktur_pembelian_item" (
    "id" TEXT NOT NULL,
    "fakturId" TEXT NOT NULL,
    "produkId" TEXT,
    "deskripsi" TEXT NOT NULL,
    "kuantitas" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "harga" DECIMAL(15,2) NOT NULL,
    "diskonPersen" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "kodeAkun" TEXT,
    "jumlah" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "faktur_pembelian_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faktur_pembelian_lampiran" (
    "id" TEXT NOT NULL,
    "fakturId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faktur_pembelian_lampiran_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_nama_idx" ON "supplier"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "faktur_pembelian_noFaktur_key" ON "faktur_pembelian"("noFaktur");

-- CreateIndex
CREATE UNIQUE INDEX "faktur_pembelian_tagihanId_key" ON "faktur_pembelian"("tagihanId");

-- CreateIndex
CREATE INDEX "faktur_pembelian_supplierId_idx" ON "faktur_pembelian"("supplierId");

-- CreateIndex
CREATE INDEX "faktur_pembelian_tanggal_idx" ON "faktur_pembelian"("tanggal");

-- CreateIndex
CREATE INDEX "faktur_pembelian_tagihanId_idx" ON "faktur_pembelian"("tagihanId");

-- CreateIndex
CREATE INDEX "faktur_pembelian_item_fakturId_idx" ON "faktur_pembelian_item"("fakturId");

-- CreateIndex
CREATE INDEX "faktur_pembelian_lampiran_fakturId_idx" ON "faktur_pembelian_lampiran"("fakturId");

-- AddForeignKey
ALTER TABLE "faktur_pembelian" ADD CONSTRAINT "faktur_pembelian_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faktur_pembelian" ADD CONSTRAINT "faktur_pembelian_tagihanId_fkey" FOREIGN KEY ("tagihanId") REFERENCES "tagihan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faktur_pembelian" ADD CONSTRAINT "faktur_pembelian_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faktur_pembelian_item" ADD CONSTRAINT "faktur_pembelian_item_fakturId_fkey" FOREIGN KEY ("fakturId") REFERENCES "faktur_pembelian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faktur_pembelian_lampiran" ADD CONSTRAINT "faktur_pembelian_lampiran_fakturId_fkey" FOREIGN KEY ("fakturId") REFERENCES "faktur_pembelian"("id") ON DELETE CASCADE ON UPDATE CASCADE;
