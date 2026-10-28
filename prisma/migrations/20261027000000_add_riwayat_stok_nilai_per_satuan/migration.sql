-- Add column nilaiPerSatuan to riwayat_stok to match schema.prisma
ALTER TABLE "riwayat_stok"
ADD COLUMN IF NOT EXISTS "nilaiPerSatuan" DECIMAL(15,2);
