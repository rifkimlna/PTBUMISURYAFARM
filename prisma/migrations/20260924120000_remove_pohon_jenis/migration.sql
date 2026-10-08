-- Remove redundant `jenis` column on pohon, keep `varietas` as single source of truth
-- Pre-check showed only 1 divergent row (PHN-BLK-A010: jenis='Montong' vs varietas='Durian Montong'), varietas is the fuller value.

-- DropIndex
DROP INDEX IF EXISTS "pohon_jenis_idx";

-- AlterTable
ALTER TABLE "pohon" DROP COLUMN IF EXISTS "jenis";

-- CreateIndex (replacement for filter performance)
CREATE INDEX IF NOT EXISTS "pohon_varietas_idx" ON "pohon"("varietas");
