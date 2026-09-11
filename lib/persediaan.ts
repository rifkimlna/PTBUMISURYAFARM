// Logika domain Persediaan Barang
// Threshold 'Stok Menipis' - mudah diubah, satu tempat saja.
export const STOK_MENIPIS_THRESHOLD = 20;

// Status stok otomatis berdasarkan jumlah stok saat ini.
export function tentukanStatusStok(stok: number): "Tersedia" | "Stok Menipis" | "Habis" {
  if (stok <= 0) return "Habis";
  if (stok <= STOK_MENIPIS_THRESHOLD) return "Stok Menipis";
  return "Tersedia";
}

// Barang + agregasi riwayat -> stok saat ini.
// stok = stokAwal + total MASUK - total KELUAR
export function hitungStokSaatIni(
  stokAwal: number,
  riwayat: { jenis: "MASUK" | "KELUAR"; jumlah: number }[]
): number {
  let total = stokAwal;
  for (const r of riwayat) {
    total += r.jenis === "MASUK" ? r.jumlah : -r.jumlah;
  }
  return total;
}