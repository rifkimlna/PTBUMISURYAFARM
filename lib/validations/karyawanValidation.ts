import { z } from "zod";

export const StatusKaryawanEnum = z.enum(["TETAP", "KONTRAK", "HARIAN"]);
export const StatusGajiEnum = z.enum(["SUDAH_DIBAYAR", "PENDING"]);

// Custom ID EMP-001
const customKaryawanIdRegex = /^EMP-\d{3,}$/;
const bulanTahunRegex = /^\d{4}-(0[1-9]|1[0-2])$/; // YYYY-MM

export const createKaryawanSchema = z.object({
  id: z
    .string()
    .regex(customKaryawanIdRegex, "ID harus format EMP-001"),
  namaLengkap: z.string().min(3, "Nama minimal 3 karakter").max(100),
  jabatan: z.string().min(2, "Jabatan wajib diisi").max(50),
  statusKerja: StatusKaryawanEnum,
  gajiPokok: z
    .number({ message: "Gaji pokok harus angka" })
    .positive("Gaji harus positif")
    .min(100000, "Gaji minimal Rp 100.000")
    .max(100_000_000, "Gaji terlalu besar"),
  tanggalMasuk: z.coerce.date({ message: "Tanggal masuk tidak valid" }),
});

export const updateKaryawanSchema = z.object({
  namaLengkap: z.string().min(3).max(100).optional(),
  jabatan: z.string().min(2).max(50).optional(),
  statusKerja: StatusKaryawanEnum.optional(),
  gajiPokok: z.number().positive().min(100000).max(100_000_000).optional(),
  tanggalMasuk: z.coerce.date().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Minimal satu field harus diisi",
});

export const createRiwayatGajiSchema = z.object({
  karyawanId: z.string().regex(customKaryawanIdRegex),
  bulanTahun: z
    .string()
    .regex(bulanTahunRegex, "Format harus YYYY-MM (contoh: 2026-09)"),
  totalGaji: z
    .number()
    .positive("Total gaji harus positif")
    .min(100000)
    .max(100_000_000),
  status: StatusGajiEnum.default("PENDING").optional(),
  tanggalBayar: z.coerce.date().optional().nullable(),
});

export const updateRiwayatGajiSchema = z.object({
  totalGaji: z.number().positive().min(100000).max(100_000_000).optional(),
  status: StatusGajiEnum.optional(),
  tanggalBayar: z.coerce.date().optional().nullable(),
  bulanTahun: z.string().regex(bulanTahunRegex).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Minimal satu field harus diisi",
});

export const queryKaryawanSchema = z.object({
  statusKerja: StatusKaryawanEnum.optional(),
  jabatan: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

export type CreateKaryawanInput = z.infer<typeof createKaryawanSchema>;
export type UpdateKaryawanInput = z.infer<typeof updateKaryawanSchema>;
export type CreateGajiInput = z.infer<typeof createRiwayatGajiSchema>;
