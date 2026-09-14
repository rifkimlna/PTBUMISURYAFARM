/*
  Warnings:

  - You are about to drop the column `desa` on the `pohon` table. All the data in the column will be lost.
  - You are about to drop the column `kecamatan` on the `pohon` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "pohon" DROP COLUMN "desa",
DROP COLUMN "kecamatan";
