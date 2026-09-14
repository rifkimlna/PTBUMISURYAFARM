-- CreateEnum
CREATE TYPE "JenisPerawatan" AS ENUM ('PUPUK', 'OBAT', 'LAIN');

-- CreateEnum
CREATE TYPE "StatusJadwal" AS ENUM ('RENCANA', 'SELESAI', 'BATAL');

-- CreateTable
CREATE TABLE "blok" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "luasHa" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blok_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jadwal_perawatan" (
    "id" TEXT NOT NULL,
    "blok" TEXT NOT NULL,
    "pohonId" TEXT,
    "jenis" "JenisPerawatan" NOT NULL,
    "tanggalRencana" TIMESTAMP(3) NOT NULL,
    "status" "StatusJadwal" NOT NULL DEFAULT 'RENCANA',
    "catatan" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jadwal_perawatan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blok_kode_key" ON "blok"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "blok_nama_key" ON "blok"("nama");

-- CreateIndex
CREATE INDEX "jadwal_perawatan_blok_idx" ON "jadwal_perawatan"("blok");

-- CreateIndex
CREATE INDEX "jadwal_perawatan_tanggalRencana_idx" ON "jadwal_perawatan"("tanggalRencana");

-- CreateIndex
CREATE INDEX "jadwal_perawatan_status_idx" ON "jadwal_perawatan"("status");

-- AddForeignKey
ALTER TABLE "jadwal_perawatan" ADD CONSTRAINT "jadwal_perawatan_pohonId_fkey" FOREIGN KEY ("pohonId") REFERENCES "pohon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_perawatan" ADD CONSTRAINT "jadwal_perawatan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
