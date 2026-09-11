-- CreateTable
CREATE TABLE "panen" (
    "id" TEXT NOT NULL,
    "pohonId" TEXT NOT NULL,
    "tanggalPanen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jumlahKg" DECIMAL(10,2) NOT NULL,
    "petugasId" TEXT,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "panen_pohonId_idx" ON "panen"("pohonId");

-- CreateIndex
CREATE INDEX "panen_tanggalPanen_idx" ON "panen"("tanggalPanen");

-- CreateIndex
CREATE INDEX "panen_petugasId_idx" ON "panen"("petugasId");

-- AddForeignKey
ALTER TABLE "panen" ADD CONSTRAINT "panen_pohonId_fkey" FOREIGN KEY ("pohonId") REFERENCES "pohon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panen" ADD CONSTRAINT "panen_petugasId_fkey" FOREIGN KEY ("petugasId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
