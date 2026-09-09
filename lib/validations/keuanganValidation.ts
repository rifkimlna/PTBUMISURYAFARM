import { z } from "zod";

export const TipeTransaksiEnum = z.enum(["PEMASUKAN", "PENGELUARAN"]);
export const StatusGajiEnum = z.enum(["SUDAH_DIBAYAR", "PENDING"]);

// Kategori umum - bisa di-extend
export const kategoriKeuanganList = [
  "Penjualan Sawit",
  "Penjualan Bibit",
  "Gaji Karyawan",
  "Pupuk",
  "Pestisida",
  "Perawatan Alat",
  "Bahan Bakar",
  "Pembelian Aset",
  "Operasional",
  "Lainnya",
] as const;

export const createTransaksiKasSchema = z.object({
  tipe: TipeTransaksiEnum,
  kategori: z.string().min(2, "Kategori minimal 2 karakter").max(50),
  jumlah: z
    .number({ message: "Jumlah harus angka" })
    .positive("Jumlah harus positif")
    .min(1000, "Jumlah minimal Rp 1.000")
    .max(10_000_000_000, "Jumlah terlalu besar"),
  keterangan: z.string().max(1000, "Keterangan maksimal 1000 karakter").optional().nullable(),
  tanggal: z.coerce.date().optional(), // default now()
  // adminId diambil dari session
});

export const updateTransaksiKasSchema = z.object({
  tipe: TipeTransaksiEnum.optional(),
  kategori: z.string().min(2).max(50).optional(),
  jumlah: z.number().positive().min(1000).max(10_000_000_000).optional(),
  keterangan: z.string().max(1000).optional().nullable(),
  tanggal: z.coerce.date().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Minimal satu field harus diisi",
});

export const queryKeuanganSchema = z.object({
  tipe: TipeTransaksiEnum.optional(),
  kategori: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

// Validasi Aset
export const createAsetSchema = z.object({
  id: z
    .string()
    .regex(/^AST-\d{3,}$/, "ID harus format AST-001"),
  namaAset: z.string().min(2).max(100),
  jumlah: z.number().int().min(1, "Jumlah minimal 1"),
  kondisi: z.string().min(2).max(50), // Baik, Rusak Ringan, etc
  nilaiAset: z.number().positive().min(1000).max(10_000_000_000),
});

export const updateAsetSchema = z.object({
  namaAset: z.string().min(2).max(100).optional(),
  jumlah: z.number().int().min(1).optional(),
  kondisi: z.string().min(2).max(50).optional(),
  nilaiAset: z.number().positive().min(1000).max(10_000_000_000).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Minimal satu field harus diisi",
});

export type CreateTransaksiInput = z.infer<typeof createTransaksiKasSchema>;
export type UpdateTransaksiInput = z.infer<typeof updateTransaksiKasSchema>;
export type CreateAsetInput = z.infer<typeof createAsetSchema>;
