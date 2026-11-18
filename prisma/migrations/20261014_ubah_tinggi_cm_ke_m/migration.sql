-- Ubah tinggi pohon cm (Integer) -> m (Decimal 6,2). Lingkar tetap cm.
ALTER TABLE "pohon" ADD COLUMN IF NOT EXISTS "tinggiM" DECIMAL(6,2);
UPDATE "pohon" SET "tinggiM" = ROUND("tinggiCm"::numeric / 100.0, 2) WHERE "tinggiCm" IS NOT NULL AND "tinggiM" IS NULL;
DROP INDEX IF EXISTS "pohon_tinggiCm_idx";
ALTER TABLE "pohon" DROP COLUMN IF EXISTS "tinggiCm";
CREATE INDEX IF NOT EXISTS "pohon_tinggiM_idx" ON "pohon"("tinggiM");
