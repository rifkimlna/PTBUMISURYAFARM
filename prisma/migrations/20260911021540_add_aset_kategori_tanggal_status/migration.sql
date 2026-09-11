-- AlterTable
ALTER TABLE "aset" ADD COLUMN     "kategori" TEXT NOT NULL DEFAULT 'Tanah',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Aktif',
ADD COLUMN     "tanggalPerolehan" TIMESTAMP(3);

-- Backfill data lama: tanggal perolehan mengikuti tanggal pencatatan (createdAt)
UPDATE "aset" SET "tanggalPerolehan" = "createdAt";

-- Backfill data lama: kategori terbaik per aset yang sudah ada
UPDATE "aset" SET "kategori" = CASE "id"
  WHEN 'AST-001' THEN 'Mesin & Peralatan Pertanian/Peternakan' -- Truk Pengangkut Sawit
  WHEN 'AST-002' THEN 'Mesin & Peralatan Pertanian/Peternakan' -- Mesin Genset
  WHEN 'AST-003' THEN 'Mesin & Peralatan Pertanian/Peternakan' -- Traktor
  WHEN 'AST-004' THEN 'Bangunan & Instalasi'                   -- Gudang Penyimpanan
  WHEN 'AST-005' THEN 'Perabotan & Peralatan Kantor/Villa'     -- Kursi
  ELSE 'Tanah'
END;

-- Hapus default sementara agar kondisi akhir sesuai schema (kategori wajib tanpa default)
ALTER TABLE "aset" ALTER COLUMN "kategori" DROP DEFAULT;