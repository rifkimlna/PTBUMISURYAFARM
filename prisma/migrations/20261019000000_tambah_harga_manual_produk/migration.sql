-- Harga manual opsional untuk tabel Produk & laporan Ringkasan Stok.
-- NULL = tetap memakai perhitungan transaksi faktur pembelian.
ALTER TABLE "persediaan_barang"
  ADD COLUMN "hargaRataRataManual" DECIMAL(15, 2),
  ADD COLUMN "hargaBeliTerakhirManual" DECIMAL(15, 2);
