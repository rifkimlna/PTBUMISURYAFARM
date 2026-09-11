// Domain Inventaris Aset PT Bumi Surya Farm - sumber tunggal kategori & status.
export const KATEGORI_ASET = [
  "Tanah",
  "Bangunan & Instalasi",
  "Mesin & Peralatan Pertanian/Peternakan",
  "Perabotan & Peralatan Kantor/Villa",
  "Tanaman Produktif",
  "Ternak",
  "Ikan Budidaya",
] as const;

export const STATUS_ASET = [
  "Aktif",
  "Tidak Digunakan",
  "Dipinjamkan",
  "Dijual",
  "Dihapus",
] as const;

export type KategoriAset = (typeof KATEGORI_ASET)[number];
export type StatusAset = (typeof STATUS_ASET)[number];