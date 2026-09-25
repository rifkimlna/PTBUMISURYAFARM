-- CreateTable
CREATE TABLE "biaya" (
    "id" TEXT NOT NULL,
    "noBiaya" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jatuhTempo" TIMESTAMP(3),
    "kategori" TEXT NOT NULL,
    "kodeAkun" TEXT,
    "penerima" TEXT NOT NULL,
    "jumlah" DECIMAL(15,2) NOT NULL,
    "sisa" DECIMAL(15,2) NOT NULL,
    "status" "StatusTagihan" NOT NULL DEFAULT 'BELUM_LUNAS',
    "tags" TEXT,
    "memo" TEXT,
    "tagihanId" TEXT,
    "transaksiKasId" TEXT,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "biaya_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "biaya_noBiaya_key" ON "biaya"("noBiaya");

-- CreateIndex
CREATE UNIQUE INDEX "biaya_tagihanId_key" ON "biaya"("tagihanId");

-- CreateIndex
CREATE UNIQUE INDEX "biaya_transaksiKasId_key" ON "biaya"("transaksiKasId");

-- CreateIndex
CREATE INDEX "biaya_tanggal_idx" ON "biaya"("tanggal");

-- CreateIndex
CREATE INDEX "biaya_status_idx" ON "biaya"("status");

-- AddForeignKey
ALTER TABLE "biaya" ADD CONSTRAINT "biaya_tagihanId_fkey" FOREIGN KEY ("tagihanId") REFERENCES "tagihan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biaya" ADD CONSTRAINT "biaya_transaksiKasId_fkey" FOREIGN KEY ("transaksiKasId") REFERENCES "transaksi_kas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biaya" ADD CONSTRAINT "biaya_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
