-- AlterTable: persiapan modul Penjualan (nullable, baris lama aman)
ALTER TABLE "tagihan" ADD COLUMN     "noInvoice" TEXT,
ADD COLUMN     "jenis" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tagihan_noInvoice_key" ON "tagihan"("noInvoice");
