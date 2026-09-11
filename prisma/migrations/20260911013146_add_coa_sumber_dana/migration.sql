-- CreateEnum
CREATE TYPE "SumberDana" AS ENUM ('KAS', 'BANK', 'TABUNGAN');

-- AlterTable
ALTER TABLE "transaksi_kas" ADD COLUMN     "kodeAkun" TEXT,
ADD COLUMN     "sumberDana" "SumberDana" NOT NULL DEFAULT 'KAS';

-- CreateIndex
CREATE INDEX "transaksi_kas_sumberDana_idx" ON "transaksi_kas"("sumberDana");
