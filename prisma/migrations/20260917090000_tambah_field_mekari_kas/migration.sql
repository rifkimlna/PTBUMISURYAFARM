-- AlterTable: field gaya Mekari untuk form Terima/Kirim/Transfer Uang
ALTER TABLE "transaksi_kas" ADD COLUMN     "noTransaksi" TEXT,
ADD COLUMN     "pihak" TEXT,
ADD COLUMN     "tag" TEXT,
ADD COLUMN     "deskripsi" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "transaksi_kas_noTransaksi_key" ON "transaksi_kas"("noTransaksi");
