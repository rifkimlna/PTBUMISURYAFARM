import { z } from "zod";

// Enum mirrors for runtime validation
export const StatusKesehatanEnum = z.enum(["SEHAT", "PERLU_PERHATIAN", "SAKIT", "MATI"]);

// Custom ID: PHN-BLK-A01, PHN-A01-001, etc - flexible but must PHN- prefix
const customPohonIdRegex = /^PHN-[A-Z0-9-]+$/;

export const createPohonSchema = z.object({
  id: z
    .string()
    .min(3, "ID minimal 3 karakter")
    .max(30, "ID maksimal 30 karakter")
    .regex(customPohonIdRegex, "ID harus format PHN-* (contoh: PHN-BLK-A01)"),
  varietas: z.string().min(2, "Varietas minimal 2 karakter").max(100),
  lokasiBlok: z.string().min(2, "Lokasi blok wajib diisi").max(50),
  tanggalTanam: z.coerce.date({ message: "Tanggal tanam tidak valid" }),
  status: StatusKesehatanEnum.default("SEHAT").optional(),
});

export const updatePohonSchema = z.object({
  varietas: z.string().min(2).max(100).optional(),
  lokasiBlok: z.string().min(2).max(50).optional(),
  tanggalTanam: z.coerce.date().optional(),
  status: StatusKesehatanEnum.optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Minimal satu field harus diisi untuk update",
});

// Validasi untuk RiwayatKesehatan (input kesehatan pohon)
export const createRiwayatKesehatanSchema = z.object({
  gejala: z.string().min(5, "Gejala minimal 5 karakter").max(2000),
  tindakan: z.string().min(5, "Tindakan minimal 5 karakter").max(2000),
  fotoUrl: z
    .string()
    .url("fotoUrl harus URL valid")
    .max(1000)
    .optional()
    .nullable()
    .or(z.literal("")),
  tanggalCek: z.coerce.date().optional(), // default now()
  // petugasId diambil dari session, tidak perlu dari body
});

export const updateRiwayatKesehatanSchema = z.object({
  gejala: z.string().min(5).max(2000).optional(),
  tindakan: z.string().min(5).max(2000).optional(),
  fotoUrl: z.string().url().max(1000).optional().nullable(),
  tanggalCek: z.coerce.date().optional(),
});

// Query filter untuk list pohon
export const queryPohonSchema = z.object({
  lokasiBlok: z.string().optional(),
  status: StatusKesehatanEnum.optional(),
  varietas: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

export type CreatePohonInput = z.infer<typeof createPohonSchema>;
export type UpdatePohonInput = z.infer<typeof updatePohonSchema>;
export type CreateRiwayatInput = z.infer<typeof createRiwayatKesehatanSchema>;
