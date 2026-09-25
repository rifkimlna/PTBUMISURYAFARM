-- AlterTable
ALTER TABLE "persediaan_barang" ADD COLUMN     "kodeAkunCOA" TEXT;

-- AlterTable
ALTER TABLE "transaksi_kas" ADD COLUMN     "sumberDanaTujuan" "SumberDana";
