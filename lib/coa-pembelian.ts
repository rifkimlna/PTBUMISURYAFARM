export type AkunCOAPembelian = {
  kode: string;
  nama: string;
  kelompok: string;
  golongan: string;
};

const KODE_PERSEDIAAN = new Set(["1105", "1106", "1107"]);

export function isAkunPersediaanPembelian(akun: AkunCOAPembelian): boolean {
  if (akun.kelompok !== "Aset") return false;
  return (
    akun.golongan === "Persediaan" ||
    /persediaan/i.test(akun.nama) ||
    KODE_PERSEDIAAN.has(akun.kode)
  );
}

export function isAkunBebanPembelian(akun: AkunCOAPembelian): boolean {
  if (akun.kelompok !== "Beban") return false;
  if (akun.golongan === "Pelunasan Hutang") return false;
  if (/pelunasan\s+hutang/i.test(akun.nama)) return false;
  return true;
}

export function isAkunDebitFakturValid(akun: AkunCOAPembelian): boolean {
  return isAkunPersediaanPembelian(akun) || isAkunBebanPembelian(akun);
}

export function labelAkunPembelian(akun: AkunCOAPembelian): string {
  return `${akun.kode} - ${akun.nama}`;
}

export function pilihAkunDefaultPembelian(
  produk: { kategori?: string | null; kodeAkunCOA?: string | null },
  akunList: AkunCOAPembelian[]
): string {
  const kode = produk.kodeAkunCOA?.trim();
  if (kode) {
    const akun = akunList.find((a) => a.kode === kode);
    if (akun && isAkunDebitFakturValid(akun)) return akun.kode;
  }

  const kategori = (produk.kategori ?? "").trim().toLowerCase();
  const kataKunci = kategori.includes("pupuk")
    ? "pupuk"
    : kategori.includes("bibit")
      ? "bibit"
      : kategori.includes("pakan")
        ? "pakan"
        : "";

  if (kataKunci) {
    const akun = akunList.find(
      (a) => isAkunPersediaanPembelian(a) && a.nama.toLowerCase().includes(kataKunci)
    );
    if (akun) return akun.kode;
  }

  return akunList.find((a) => isAkunPersediaanPembelian(a))?.kode ?? "";
}
