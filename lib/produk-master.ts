// Integrasi data produk ke master PersediaanBarang (KHUSUS server).
// JANGAN diimpor dari Client Component — hanya API route / server action.
//
// Tujuan: menyatukan sumber data antara modul Penjualan dan halaman Produk.
// Saat baris transaksi memiliki nama produk yang belum terdaftar di master,
// produk dibuat otomatis agar muncul di halaman Produk; bila sudah ada,
// produk yang sama dipakai ulang (tanpa duplikat).
//
// Aturan:
// - Pencocokan nama mengabaikan huruf besar/kecil (case-insensitive) dan
//   spasi di awal/akhir (di-trim kedua sisi).
// - Produk baru dibuat dengan stok 0 dan TANPA riwayat stok — pendaftaran
//   produk tidak pernah mengubah stok secara otomatis.
// - Kode produk memakai urutan BRG-xxx yang sama dengan modul Produk.
//
// Semua helper berjalan di dalam transaksi caller (menerima tx) agar pembuatan
// produk dan penyimpanan dokumen bersifat atomik.

import type { Prisma } from "@/generated/prisma/client";
import { generateKodeProduk } from "@/lib/persediaan";
import { kategoriPersediaanList } from "@/lib/validations/persediaanValidation";

type Tx = Prisma.TransactionClient;

// Master Produk = PersediaanBarang. Batas nama mengikuti skema persediaan.
const NAMA_MIN = 2;
const NAMA_MAX = 100;

export type SumberProduk = "PENJUALAN" | "PEMBELIAN";

/** Normalisasi nama untuk pencocokan: buang spasi awal/akhir. */
export function normalkanNamaProduk(nama: string | null | undefined): string {
  return (nama ?? "").trim();
}

/** Apakah dua nama produk merujuk produk yang sama (abaikan besar/kecil & spasi tepi). */
export function namaProdukSesuai(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalkanNamaProduk(a);
  const y = normalkanNamaProduk(b);
  if (!x || !y) return false;
  return x.toLowerCase() === y.toLowerCase();
}

export type InputProduk = {
  nama: string | null | undefined;
  satuan?: string | null;
  /** Harga jual (modul Penjualan) — mengisi hargaJual. */
  hargaJual?: number | null;
  /** Harga beli (modul Pembelian) — mengisi hargaBeli. */
  hargaBeli?: number | null;
  /** Sumber produk: PENJUALAN (hasil sendiri) atau PEMBELIAN (dari supplier).
   * Hanya ditetapkan saat produk BARU dibuat; produk existing tidak diubah
   * agar kategori tidak bergantung pada transaksi terakhir. */
  sumberProduk?: SumberProduk | null;
};

const angka = (v: number | null | undefined) =>
  Number.isFinite(v) ? Math.max(0, Number(v)) : null;

/**
 * Kembalikan id master Produk untuk sebuah nama:
 * - Bila sudah terdaftar → pakai yang ada (tanpa duplikat).
 * - Bila belum → buat produk baru (stok 0, tanpa riwayat stok).
 * - Nama terlalu pendek/panjang untuk master → null (dokumen tetap tersimpan).
 *
 * `hargaSatuan` mengikuti harga yang tersedia (jual/beli) agar valuasi tidak
 * nol; `hargaJual`/`hargaBeli` diisi hanya bila memang berasal dari sisi itu.
 */
export async function pastikanProdukId(tx: Tx, input: InputProduk): Promise<string | null> {
  const nama = normalkanNamaProduk(input.nama);
  if (nama.length < NAMA_MIN || nama.length > NAMA_MAX) return null;

  const ada = await tx.persediaanBarang.findFirst({
    where: { namaBarang: { equals: nama, mode: "insensitive" } },
    select: { id: true },
  });
  if (ada) return ada.id;

  const id = await generateKodeProduk(tx);
  const satuan = (input.satuan ?? "").trim().slice(0, 20) || "pcs";
  const hargaJual = angka(input.hargaJual);
  const hargaBeli = angka(input.hargaBeli);
  const sumberProduk = input.sumberProduk ?? null;

  const dibuat = await tx.persediaanBarang.create({
    data: {
      id,
      namaBarang: nama,
      kategori: kategoriPersediaanList[0],
      sumberProduk,
      satuan,
      hargaSatuan: hargaJual ?? hargaBeli ?? 0,
      hargaJual,
      hargaBeli,
      stokAwal: 0,
      batasMinimum: 0,
    },
    select: { id: true },
  });
  return dibuat.id;
}

// Bentuk baris item dokumen Penjualan/Pembelian yang relevan untuk integrasi.
export type ItemProduk = {
  produkId?: string | null;
  deskripsi: string;
  unit?: string | null;
  harga?: number | null;
  /** Sumber produk untuk penetapan sumberProduk saat membuat produk baru. */
  sumberProduk?: SumberProduk | null;
};

/**
 * Petakan baris item dokumen: isi produkId dari master bila kosong.
 * Urutan berurutan (bukan paralel) agar dua baris bernama sama dalam satu
 * dokumen tidak membuat dua produk berbeda.
 */
export async function hubungkanProdukItem<T extends ItemProduk>(
  tx: Tx,
  items: T[]
): Promise<Array<T & { produkId: string | null }>> {
  const hasil: Array<T & { produkId: string | null }> = [];
  for (const it of items) {
    let produkId = it.produkId?.trim() || null;
    if (!produkId) {
      produkId = await pastikanProdukId(tx, {
        nama: it.deskripsi,
        satuan: it.unit,
        hargaJual: it.harga,
        sumberProduk: it.sumberProduk ?? null,
      });
    }
    hasil.push({ ...it, produkId });
  }
  return hasil;
}
