-- CreateTable
CREATE TABLE "bukti_transaksi" (
    "id" TEXT NOT NULL,
    "transaksiId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bukti_transaksi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bukti_transaksi_transaksiId_idx" ON "bukti_transaksi"("transaksiId");

-- AddForeignKey
ALTER TABLE "bukti_transaksi" ADD CONSTRAINT "bukti_transaksi_transaksiId_fkey" FOREIGN KEY ("transaksiId") REFERENCES "transaksi_kas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
