import { z } from "zod";

export const JenisStokEnum = z.enum(["MASUK", "KELUAR"]);

export const SumberDanaEnum = z.enum(["KAS", "BANK", "TABUNGAN"]);

// Kategori mengikuti pembukuan perusahaan
export const kategoriPersediaanList = [
  "Bibit/Benih",
  "Pupuk & Obat-obatan",
  "Pakan Ternak/Ikan",
] as const;

export type KategoriPersediaan = typeof kategoriPersediaanList[number];

export const createPersediaanBarangSchema = z.object({
  kode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^BRG-\d{3,}$/, "Kode harus format BRG-001 (contoh: BRG-005)")
    .optional(),
  namaBarang: z.string().min(2, "Nama barang minimal 2 karakter").max(100).trim(),
  kategori: z.enum(kategoriPersediaanList, {
    message: "Kategori tidak valid",
  }),
  kodeAkunCOA: z.string().max(10).optional().nullable(),
  stokAwal: z.coerce.number().int("Stok awal harus bilangan bulat").min(0, "Stok awal minimal 0").default(0),
  satuan: z.string().min(1, "Satuan wajib diisi").max(20).trim(),
  hargaSatuan: z.coerce
    .number()
    .nonnegative("Harga satuan tidak boleh negatif")
    .min(0)
    .max(10_000_000_000, "Harga terlalu besar")
    .optional(),
  keterangan: z.string().max(500, "Keterangan maksimal 500 karakter").optional().nullable(),
  // --- Modul Produk (opsional; COA tetap di backend, tidak tampil di form) ---
  barcode: z
    .string()
    .trim()
    .max(50, "Barcode maksimal 50 karakter")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  tipeProduk: z.enum(["BARANG", "JASA"]).optional().nullable(),
  hargaBeli: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().nonnegative("Harga beli tidak boleh negatif").max(10_000_000_000, "Harga terlalu besar").optional().nullable()
  ),
  hargaJual: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().nonnegative("Harga jual tidak boleh negatif").max(10_000_000_000, "Harga terlalu besar").optional().nullable()
  ),
  batasMinimum: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().int("Batas minimum harus bilangan bulat").min(0, "Batas minimum minimal 0").max(1_000_000).optional().nullable()
  ),
});

// Kode & stokAwal tidak bisa diedit - stok hanya diubah lewat Penyesuaian Stok
export const updatePersediaanBarangSchema = z
  .object({
    namaBarang: z.string().min(2).max(100).trim().optional(),
    kategori: z.enum(kategoriPersediaanList).optional(),
    kodeAkunCOA: z.string().max(10).optional().nullable(),
    satuan: z.string().min(1).max(20).trim().optional(),
    hargaSatuan: z.coerce
      .number()
      .nonnegative()
      .min(0)
      .max(10_000_000_000)
      .optional(),
    keterangan: z.string().max(500).optional().nullable(),
    barcode: z
      .string()
      .trim()
      .max(50, "Barcode maksimal 50 karakter")
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    tipeProduk: z.enum(["BARANG", "JASA"]).optional().nullable(),
    hargaBeli: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.coerce.number().nonnegative().max(10_000_000_000).optional().nullable()
    ),
    hargaJual: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.coerce.number().nonnegative().max(10_000_000_000).optional().nullable()
    ),
    batasMinimum: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.coerce.number().int().min(0).max(1_000_000).optional().nullable()
    ),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Minimal satu field harus diisi",
  });

export const createRiwayatStokSchema = z.object({
  jenis: JenisStokEnum,
  jumlah: z.coerce.number().int("Jumlah harus bilangan bulat").min(1, "Jumlah minimal 1").max(1_000_000, "Jumlah terlalu besar"),
  keterangan: z.string().max(500, "Keterangan maksimal 500 karakter").optional().nullable(),
  tanggal: z.coerce.date().optional(), // default now()
  // Asal catatan (tanpa efek Kas/Bank): PENYESUAIAN = hasil stock opname.
  sumber: z.enum(["PENYESUAIAN", "PEMBELIAN", "MANUAL"]).optional().nullable(),
});

// Schema untuk Pembelian/Barang Masuk Terintegrasi (Stok + Kas + COA)
export const createPembelianSchema = z.object({
  barangId: z.string().min(1, "Barang wajib dipilih"),
  jumlah: z.coerce.number().int("Jumlah harus bilangan bulat").min(1, "Jumlah minimal 1").max(1_000_000, "Jumlah terlalu besar"),
  hargaSatuan: z.coerce
    .number()
    .positive("Harga satuan harus positif")
    .min(1000, "Harga satuan minimal Rp 1.000")
    .max(10_000_000_000, "Harga terlalu besar"),
  sumberDana: SumberDanaEnum,
  tanggal: z.coerce.date().optional(), // default now()
  keterangan: z.string().max(1000, "Keterangan maksimal 1000 karakter").optional().nullable(),
  bukti: z.array(z.object({
    fileName: z.string().min(1, "Nama file wajib").max(200),
    fileUrl: z.string().min(1, "Path file wajib").max(500),
    fileType: z.string().max(100).optional(),
    fileSize: z.number().int().nonnegative().optional(),
  })).max(20, "Maksimal 20 bukti per transaksi").optional(),
});

// Schema untuk Pembelian/Barang Masuk Terintegrasi (Stok + Kas + COA)
export const createPembelianSchema = z.object({
  barangId: z.string().min(1, "Barang wajib dipilih"),
  jumlah: z.coerce.number().int("Jumlah harus bilangan bulat").min(1, "Jumlah minimal 1").max(1_000_000, "Jumlah terlalu besar"),
  hargaSatuan: z.coerce
    .number()
    .positive("Harga satuan harus positif")
    .min(1000, "Harga satuan minimal Rp 1.000")
    .max(10_000_000_000, "Harga terlalu besar"),
  sumberDana: SumberDanaEnum,
  tanggal: z.coerce.date().optional(), // default now()
  keterangan: z.string().max(1000, "Keterangan maksimal 1000 karakter").optional().nullable(),
  bukti: z.array(z.object({
    fileName: z.string().min(1, "Nama file wajib").max(200),
    fileUrl: z.string().min(1, "Path file wajib").max(500),
    fileType: z.string().max(100).optional(),
    fileSize: z.number().int().nonnegative().optional(),
  })).max(20, "Maksimal 20 bukti per transaksi").optional(),
});

export type CreatePersediaanBarangInput = z.infer<typeof createPersediaanBarangSchema>;
export type UpdatePersediaanBarangInput = z.infer<typeof updatePersediaanBarangSchema>;
export type CreateRiwayatStokInput = z.infer<typeof createRiwayatStokSchema>;
export type CreatePembelianInput = z.infer<typeof createPembelianSchema>;
export type SumberDana = z.infer<typeof SumberDanaEnum>;