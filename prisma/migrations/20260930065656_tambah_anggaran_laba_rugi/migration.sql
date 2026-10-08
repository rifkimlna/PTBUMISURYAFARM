-- CreateTable
CREATE TABLE "anggaran_laba_rugi" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tahunMulai" INTEGER NOT NULL,
    "bulanMulai" INTEGER NOT NULL,
    "durasi" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anggaran_laba_rugi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anggaran_item" (
    "id" TEXT NOT NULL,
    "anggaranId" TEXT NOT NULL,
    "kodeAkun" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "bulan" INTEGER NOT NULL,
    "nominal" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "anggaran_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anggaran_laba_rugi_tahunMulai_bulanMulai_idx" ON "anggaran_laba_rugi"("tahunMulai", "bulanMulai");

-- CreateIndex
CREATE INDEX "anggaran_item_anggaranId_idx" ON "anggaran_item"("anggaranId");

-- CreateIndex
CREATE UNIQUE INDEX "anggaran_item_anggaranId_kodeAkun_tahun_bulan_key" ON "anggaran_item"("anggaranId", "kodeAkun", "tahun", "bulan");

-- AddForeignKey
ALTER TABLE "anggaran_laba_rugi" ADD CONSTRAINT "anggaran_laba_rugi_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anggaran_item" ADD CONSTRAINT "anggaran_item_anggaranId_fkey" FOREIGN KEY ("anggaranId") REFERENCES "anggaran_laba_rugi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
