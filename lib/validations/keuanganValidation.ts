import { z } from "zod";
import { KATEGORI_ASET, STATUS_ASET } from "@/lib/aset";

export const TipeTransaksiEnum = z.enum(["PEMASUKAN", "PENGELUARAN"]);
export const SumberDanaEnum = z.enum(["KAS", "BANK", "TABUNGAN"]);
export const StatusGajiEnum = z.enum(["SUDAH_DIBAYAR", "PENDING"]);

export type TipeTransaksi = z.infer<typeof TipeTransaksiEnum>;
export type SumberDana = z.infer<typeof SumberDanaEnum>;

export const createBuktiTransaksiSchema = z.object({
  fileName: z.string().min(1, "Nama file wajib").max(200),
  fileUrl: z.string().min(1, "Path file wajib").max(500),
  fileType: z.string().max(100).optional(),
  fileSize: z.number().int().nonnegative().optional(),
});

export const createTransaksiKasSchema = z.object({
  tipe: TipeTransaksiEnum,
  kategori: z.string().min(2, "Kategori minimal 2 karakter").max(100),
  sumberDana: SumberDanaEnum.default("KAS"),
  jumlah: z
    .number({ message: "Jumlah harus angka" })
    .positive("Jumlah harus positif")
    .min(1000, "Jumlah minimal Rp 1.000")
    .max(10_000_000_000, "Jumlah terlalu besar"),
  keterangan: z.string().max(1000, "Keterangan maksimal 1000 karakter").optional().nullable(),
  tanggal: z.coerce.date().optional(), // default now()
  bukti: z.array(createBuktiTransaksiSchema).max(20, "Maksimal 20 bukti per transaksi").optional(),
  // adminId diambil dari session
});

export const updateTransaksiKasSchema = z.object({
  tipe: TipeTransaksiEnum.optional(),
  kategori: z.string().min(2).max(100).optional(),
  sumberDana: SumberDanaEnum.optional(),
  jumlah: z.number().positive().min(1000).max(10_000_000_000).optional(),
  keterangan: z.string().max(1000).optional().nullable(),
  tanggal: z.coerce.date().optional(),
  bukti: z.array(createBuktiTransaksiSchema).max(20, "Maksimal 20 bukti per transaksi").optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Minimal satu field harus diisi",
});

export const queryKeuanganSchema = z.object({
  tipe: TipeTransaksiEnum.optional(),
  kategori: z.string().optional(),
  sumberDana: SumberDanaEnum.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

// Validasi Aset - pakai coerce biar string "1" dari form tetap valid
export const createAsetSchema = z.object({
  id: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^AST-\d{3,}$/, "ID harus format AST-001 (contoh: AST-005)"),
  namaAset: z.string().min(2, "Nama aset minimal 2 karakter").max(100).trim(),
  jumlah: z.coerce.number().int().min(1, "Jumlah minimal 1"),
  kategori: z.enum(KATEGORI_ASET, { message: "Kategori harus dari daftar COA" }),
  kondisi: z.string().min(2, "Kondisi wajib diisi").max(50).trim(),
  status: z.enum(STATUS_ASET, { message: "Status harus dari daftar yang tersedia" }).default("Aktif"),
  nilaiAset: z.coerce.number().positive("Nilai harus positif").min(1000, "Nilai minimal Rp 1.000").max(10_000_000_000, "Nilai terlalu besar"),
  tanggalPerolehan: z.coerce.date().optional().nullable(),
});

export const updateAsetSchema = z.object({
  namaAset: z.string().min(2).max(100).optional(),
  jumlah: z.coerce.number().int().min(1).optional(),
  kategori: z.enum(KATEGORI_ASET, { message: "Kategori harus dari daftar COA" }).optional(),
  kondisi: z.string().min(2).max(50).optional(),
  status: z.enum(STATUS_ASET, { message: "Status harus dari daftar yang tersedia" }).optional(),
  nilaiAset: z.coerce.number().positive().min(1000).max(10_000_000_000).optional(),
  tanggalPerolehan: z.coerce.date().optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Minimal satu field harus diisi",
});

export type CreateTransaksiInput = z.infer<typeof createTransaksiKasSchema>;
export type UpdateTransaksiInput = z.infer<typeof updateTransaksiKasSchema>;
export type CreateAsetInput = z.infer<typeof createAsetSchema>;
export type BuktiTransaksiInput = z.infer<typeof createBuktiTransaksiSchema>;
