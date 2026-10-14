// Klasifikasi ukuran pohon otomatis dari tinggi (m).
// Threshold global untuk Durian / Alpukat / Jambu (MVP simpel).
// KECIL <1.50, SEDANG 1.50-4.00, BESAR >4.00. Null = belum ukur.

export type KategoriUkuran = "BELUM_UKUR" | "KECIL" | "SEDANG" | "BESAR";

export function klasifikasiUkuran(tinggiM: number | null | undefined): KategoriUkuran {
  if (tinggiM == null || !Number.isFinite(Number(tinggiM))) return "BELUM_UKUR";
  const t = Number(tinggiM);
  if (t < 1.5) return "KECIL";
  if (t <= 4) return "SEDANG";
  return "BESAR";
}

export function labelKategori(k: KategoriUkuran): string {
  switch (k) {
    case "KECIL":
      return "Kecil";
    case "SEDANG":
      return "Sedang";
    case "BESAR":
      return "Besar";
    default:
      return "Belum ukur";
  }
}

export function phLabel(ph: number | null | undefined): string | null {
  if (ph == null || !Number.isFinite(Number(ph))) return null;
  const v = Number(ph);
  if (v < 6.0) return "Asam";
  if (v <= 7.0) return "Netral";
  return "Basa";
}
