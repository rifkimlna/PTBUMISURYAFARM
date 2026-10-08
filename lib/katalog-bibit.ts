// Helper katalog bibit publik (dipakai home + halaman detail).
// Foto: fotoUrl upload admin bila ada, else foto cadangan per varietas.

export type KatalogBibit = {
  id: string;
  nama: string;
  harga: number;
  satuan: string;
  stok: number;
  fotoUrl: string | null;
  keterangan: string | null;
  status: "Tersedia" | "Stok Menipis" | "Habis";
};

export const WA_NUMBER = "628123456789";

export function waPesanBibit(nama: string, id: string, jumlah = 1): string {
  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    `Halo PT Bumi Surya Farm, saya mau pesan ${nama} (${id}) x ${jumlah}. Apakah stok tersedia?`
  )}`;
  return url;
}

// Foto cadangan bila admin belum upload foto (per komoditas).
export function fotoCadangan(nama: string): string {
  const n = nama.toLowerCase();
  if (n.includes("durian"))
    return "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&q=80&auto=format&fit=crop&crop=center";
  if (n.includes("alpukat") || n.includes("avocado") || n.includes("mentega") || n.includes("kendil"))
    return "https://images.unsplash.com/photo-1523741543316-beb7fc7023d8?w=800&q=80&auto=format&fit=crop&crop=center";
  if (n.includes("jambu") || n.includes("kristal"))
    return "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80&auto=format&fit=crop&crop=center";
  return "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&q=80&auto=format&fit=crop&crop=center";
}

export function fotoBibit(b: Pick<KatalogBibit, "nama" | "fotoUrl">): string {
  return b.fotoUrl || fotoCadangan(b.nama);
}

// Kartu contoh bila gudang belum ada bibit sama sekali.
export const BIBIT_CONTOH: KatalogBibit[] = [
  {
    id: "CONTOH-1",
    nama: "Bibit Durian Montong",
    harga: 35000,
    satuan: "polybag",
    stok: 0,
    fotoUrl: null,
    keterangan: "Tinggi ±40cm, okulasi, siap tanam. Stok menyusul.",
    status: "Habis",
  },
  {
    id: "CONTOH-2",
    nama: "Bibit Alpukat Mentega",
    harga: 25000,
    satuan: "polybag",
    stok: 0,
    fotoUrl: null,
    keterangan: "Sambung pucuk, sehat, siap tanam. Stok menyusul.",
    status: "Habis",
  },
  {
    id: "CONTOH-3",
    nama: "Bibit Jambu Kristal",
    harga: 20000,
    satuan: "polybag",
    stok: 0,
    fotoUrl: null,
    keterangan: "Cangkok unggul, cepat berbuah. Stok menyusul.",
    status: "Habis",
  },
];
