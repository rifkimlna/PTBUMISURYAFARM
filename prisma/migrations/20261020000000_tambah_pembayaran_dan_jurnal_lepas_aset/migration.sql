-- AlterTable
ALTER TABLE "aset" ADD COLUMN     "statusPembayaran" TEXT NOT NULL DEFAULT 'BELUM_DIKONFIRMASI',
ADD COLUMN     "akunPenerima" TEXT,
ADD COLUMN     "untungRugi" DECIMAL(15,2),
ADD COLUMN     "transaksiKasJualId" TEXT,
ADD COLUMN     "tagihanPiutangId" TEXT;
