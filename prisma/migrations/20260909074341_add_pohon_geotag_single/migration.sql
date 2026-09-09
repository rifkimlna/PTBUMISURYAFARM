-- CreateEnum
CREATE TYPE "GeotagSource" AS ENUM ('GPS', 'EXIF', 'MANUAL');

-- AlterTable
ALTER TABLE "pohon" ADD COLUMN     "fotoGeotagUrl" TEXT,
ADD COLUMN     "geotagAccuracy" DOUBLE PRECISION,
ADD COLUMN     "geotagAdminId" TEXT,
ADD COLUMN     "geotagSource" "GeotagSource",
ADD COLUMN     "geotagTimestamp" TIMESTAMP(3),
ADD COLUMN     "geotagUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "pohon_geotagAdminId_idx" ON "pohon"("geotagAdminId");

-- CreateIndex
CREATE INDEX "pohon_geotagTimestamp_idx" ON "pohon"("geotagTimestamp");

-- AddForeignKey
ALTER TABLE "pohon" ADD CONSTRAINT "pohon_geotagAdminId_fkey" FOREIGN KEY ("geotagAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
