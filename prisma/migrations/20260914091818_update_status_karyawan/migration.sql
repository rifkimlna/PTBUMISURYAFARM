-- AlterEnum: KONTRAK -> TIDAK_TETAP, HARIAN -> PENDUKUNG
-- RENAME VALUE mengubah label enum sekaligus pada baris yang sudah ada (tidak ada data hilang).
ALTER TYPE "StatusKaryawan" RENAME VALUE 'KONTRAK' TO 'TIDAK_TETAP';
ALTER TYPE "StatusKaryawan" RENAME VALUE 'HARIAN' TO 'PENDUKUNG';
