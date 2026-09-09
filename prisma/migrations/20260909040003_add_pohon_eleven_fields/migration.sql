-- AlterTable
ALTER TABLE "pohon" ADD COLUMN     "hasilPanen" DECIMAL(10,2),
ADD COLUMN     "jenis" TEXT,
ADD COLUMN     "koordinat" TEXT,
ADD COLUMN     "namaPohon" TEXT,
ADD COLUMN     "pemupukan" TEXT,
ADD COLUMN     "pengobatan" TEXT;

-- CreateIndex
CREATE INDEX "pohon_jenis_idx" ON "pohon"("jenis");

-- CreateIndex
CREATE INDEX "pohon_tanggalTanam_idx" ON "pohon"("tanggalTanam");
