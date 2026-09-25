// Logika domain Persediaan Barang
// Threshold 'Stok Menipis' - mudah diubah, satu tempat saja.
export const STOK_MENIPIS_THRESHOLD = 20;

// Status stok otomatis berdasarkan jumlah stok saat ini.
export function tentukanStatusStok(stok: number): "Tersedia" | "Stok Menipis" | "Habis" {
  if (stok <= 0) return "Habis";
  if (stok <= STOK_MENIPIS_THRESHOLD) return "Stok Menipis";
  return "Tersedia";
}

// Status stok dengan ambang per produk (batasMinimum dari modul Produk).
// Bila batasMinimum 0/belum diatur, pakai ambang global lama agar perilaku
// data lama tidak berubah.
export function tentukanStatusStokDenganBatas(
  stok: number,
  batasMinimum: number | null | undefined
): "Tersedia" | "Stok Menipis" | "Habis" {
  if (stok <= 0) return "Habis";
  const ambang = batasMinimum && batasMinimum > 0 ? batasMinimum : STOK_MENIPIS_THRESHOLD;
  if (stok <= ambang) return "Stok Menipis";
  return "Tersedia";
}

// Kode produk berikutnya (BRG-001, BRG-002, ...). Memindai kode yang sudah
// dipakai agar tidak tabrakan.
export async function generateKodeProduk(prisma: {
  persediaanBarang: { findMany: (args: { select: { id: true } }) => Promise<Array<{ id: string }>> };
}): Promise<string> {
  const rows = await prisma.persediaanBarang.findMany({ select: { id: true } });
  let max = 0;
  for (const r of rows) {
    const m = /^BRG-(\d{3,})$/.exec((r.id ?? "").trim().toUpperCase());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `BRG-${String(max + 1).padStart(3, "0")}`;
}

// Kode gudang berikutnya (GDG-001, GDG-002, ...).
export async function generateKodeGudang(prisma: {
  gudang: { findMany: (args: { select: { kode: true } }) => Promise<Array<{ kode: string }>> };
}): Promise<string> {
  const rows = await prisma.gudang.findMany({ select: { kode: true } });
  let max = 0;
  for (const r of rows) {
    const m = /^GDG-(\d{3,})$/.exec((r.kode ?? "").trim().toUpperCase());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `GDG-${String(max + 1).padStart(3, "0")}`;
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