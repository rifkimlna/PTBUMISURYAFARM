-- CreateEnum
CREATE TYPE "TipeTagihan" AS ENUM ('HUTANG', 'PIUTANG');

-- CreateEnum
CREATE TYPE "StatusTagihan" AS ENUM ('BELUM_LUNAS', 'LUNAS_SEBAGIAN', 'LUNAS');

-- CreateTable
CREATE TABLE "tagihan" (
    "id" TEXT NOT NULL,
    "tipe" "TipeTagihan" NOT NULL,
    "pihak" TEXT NOT NULL,
    "keterangan" TEXT,
    "jumlah" DECIMAL(15,2) NOT NULL,
    "sisa" DECIMAL(15,2) NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jatuhTempo" TIMESTAMP(3),
    "status" "StatusTagihan" NOT NULL DEFAULT 'BELUM_LUNAS',
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tagihan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tagihan_tipe_idx" ON "tagihan"("tipe");

-- CreateIndex
CREATE INDEX "tagihan_status_idx" ON "tagihan"("status");

-- CreateIndex
CREATE INDEX "tagihan_jatuhTempo_idx" ON "tagihan"("jatuhTempo");

-- CreateIndex
CREATE INDEX "tagihan_adminId_idx" ON "tagihan"("adminId");

-- AddForeignKey
ALTER TABLE "tagihan" ADD CONSTRAINT "tagihan_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: relasi pembayaran tagihan -> transaksi kas (nullable agar data lama aman)
ALTER TABLE "transaksi_kas" ADD COLUMN "tagihanId" TEXT;

-- CreateIndex
CREATE INDEX "transaksi_kas_tagihanId_idx" ON "transaksi_kas"("tagihanId");

-- AddForeignKey
ALTER TABLE "transaksi_kas" ADD CONSTRAINT "transaksi_kas_tagihanId_fkey" FOREIGN KEY ("tagihanId") REFERENCES "tagihan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
