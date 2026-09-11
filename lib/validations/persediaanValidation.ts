import { z } from "zod";

export const JenisStokEnum = z.enum(["MASUK", "KELUAR"]);

// Kategori mengikuti pembukuan perusahaan
export const kategoriPersediaanList = [
  "Bibit/Benih",
  "Pupuk & Obat-obatan",
  "Pakan Ternak/Ikan",
] as const;

export const createPersediaanBarangSchema = z.object({
  kode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^BRG-\d{3,}$/, "Kode harus format BRG-001 (contoh: BRG-005)"),
  namaBarang: z.string().min(2, "Nama barang minimal 2 karakter").max(100).trim(),
  kategori: z.enum(kategoriPersediaanList, {
    message: "Kategori tidak valid",
  }),
  stokAwal: z.coerce.number().int("Stok awal harus bilangan bulat").min(0, "Stok awal minimal 0").default(0),
  satuan: z.string().min(1, "Satuan wajib diisi").max(20).trim(),
  hargaSatuan: z.coerce
    .number()
    .nonnegative("Harga satuan tidak boleh negatif")
    .min(0)
    .max(10_000_000_000, "Harga terlalu besar"),
  keterangan: z.string().max(500, "Keterangan maksimal 500 karakter").optional().nullable(),
});

// Kode & stokAwal tidak bisa diedit - stok hanya diubah lewat Stok Masuk/Keluar
export const updatePersediaanBarangSchema = z
  .object({
    namaBarang: z.string().min(2).max(100).trim().optional(),
    kategori: z.enum(kategoriPersediaanList).optional(),
    satuan: z.string().min(1).max(20).trim().optional(),
    hargaSatuan: z.coerce
      .number()
      .nonnegative()
      .min(0)
      .max(10_000_000_000)
      .optional(),
    keterangan: z.string().max(500).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Minimal satu field harus diisi",
  });

export const createRiwayatStokSchema = z.object({
  jenis: JenisStokEnum,
  jumlah: z.coerce.number().int("Jumlah harus bilangan bulat").min(1, "Jumlah minimal 1").max(1_000_000, "Jumlah terlalu besar"),
  keterangan: z.string().max(500, "Keterangan maksimal 500 karakter").optional().nullable(),
  tanggal: z.coerce.date().optional(), // default now()
});

export type CreatePersediaanBarangInput = z.infer<typeof createPersediaanBarangSchema>;
export type UpdatePersediaanBarangInput = z.infer<typeof updatePersediaanBarangSchema>;
export type CreateRiwayatStokInput = z.infer<typeof createRiwayatStokSchema>;