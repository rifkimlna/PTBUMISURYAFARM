-- DropIndex + DropColumn: hapus kolom divisi, digantikan statusKerja (TETAP / TIDAK_TETAP / PENDUKUNG)
DROP INDEX "karyawan_divisi_idx";
ALTER TABLE "karyawan" DROP COLUMN "divisi";
