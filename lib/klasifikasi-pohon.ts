// Klasifikasi ukuran pohon otomatis dari tinggi (cm).
// Threshold global untuk Durian / Alpukat / Jambu (MVP simpel).
// KECIL <150, SEDANG 150-400, BESAR >400. Null = belum ukur.

export type KategoriUkuran = "BELUM_UKUR" | "KECIL" | "SEDANG" | "BESAR";

export function klasifikasiUkuran(tinggiCm: number | null | undefined): KategoriUkuran {
  if (tinggiCm == null || !Number.isFinite(Number(tinggiCm))) return "BELUM_UKUR";
  const t = Number(tinggiCm);
  if (t < 150) return "KECIL";
  if (t <= 400) return "SEDANG";
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
