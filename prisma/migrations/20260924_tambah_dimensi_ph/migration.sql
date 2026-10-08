-- Tambah dimensi pohon + pH tanah per pohon
ALTER TABLE "pohon" ADD COLUMN IF NOT EXISTS "tinggiCm" INTEGER;
ALTER TABLE "pohon" ADD COLUMN IF NOT EXISTS "lingkarBatangCm" DECIMAL(6,2);
ALTER TABLE "pohon" ADD COLUMN IF NOT EXISTS "phTanah" DECIMAL(3,1);
ALTER TABLE "pohon" ADD COLUMN IF NOT EXISTS "diukurPada" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "pohon_tinggiCm_idx" ON "pohon"("tinggiCm");
CREATE INDEX IF NOT EXISTS "pohon_phTanah_idx" ON "pohon"("phTanah");
