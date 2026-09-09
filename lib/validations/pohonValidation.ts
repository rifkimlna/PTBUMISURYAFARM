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
  namaPohon: z.string().min(2, "Nama pohon minimal 2 karakter").max(100).optional().nullable().or(z.literal("")),
  varietas: z.string().min(2, "Varietas minimal 2 karakter").max(100),
  jenis: z.string().min(2, "Jenis minimal 2 karakter").max(50).optional().nullable().or(z.literal("")),
  lokasiBlok: z.string().min(2, "Lokasi blok wajib diisi").max(50),
  tanggalTanam: z.coerce.date({ message: "Tanggal tanam tidak valid" }),
  koordinat: z
    .string()
    .max(50, "Koordinat maksimal 50 karakter")
    .regex(/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/, "Format koordinat: -2.983, 104.752")
    .optional()
    .nullable()
    .or(z.literal("")),
  hasilPanen: z.coerce.number().min(0, "Hasil panen minimal 0").max(999999).optional().nullable(),
  pemupukan: z.string().max(2000, "Pemupukan maksimal 2000 karakter").optional().nullable().or(z.literal("")),
  pengobatan: z.string().max(2000, "Pengobatan maksimal 2000 karakter").optional().nullable().or(z.literal("")),
  status: StatusKesehatanEnum.default("SEHAT").optional(),
});

export const updatePohonSchema = z.object({
  namaPohon: z.string().min(2).max(100).optional().nullable().or(z.literal("")),
  varietas: z.string().min(2).max(100).optional(),
  jenis: z.string().min(2).max(50).optional().nullable().or(z.literal("")),
  lokasiBlok: z.string().min(2).max(50).optional(),
  tanggalTanam: z.coerce.date().optional(),
  koordinat: z.string().max(50).optional().nullable().or(z.literal("")),
  hasilPanen: z.coerce.number().min(0).max(999999).optional().nullable(),
  pemupukan: z.string().max(2000).optional().nullable().or(z.literal("")),
  pengobatan: z.string().max(2000).optional().nullable().or(z.literal("")),
  status: StatusKesehatanEnum.optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Minimal satu field harus diisi untuk update",
});

// Edit Master - identitas pohon (jarang berubah)
export const updatePohonMasterSchema = z
  .object({
    namaPohon: z.string().min(2).max(100).optional().nullable().or(z.literal("")),
    varietas: z.string().min(2).max(100).optional(),
    jenis: z.string().min(2).max(50).optional().nullable().or(z.literal("")),
    lokasiBlok: z.string().min(2).max(50).optional(),
    tanggalTanam: z.coerce.date().optional(),
    koordinat: z
      .string()
      .max(50, "Koordinat maksimal 50 karakter")
      .regex(/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/, "Format koordinat: -2.983, 104.752")
      .optional()
      .nullable()
      .or(z.literal("")),
    status: StatusKesehatanEnum.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Minimal satu field master harus diisi",
  });

// Data Lapangan - operasional harian (sering berubah di lapangan)
export const updatePohonLapanganSchema = z
  .object({
    hasilPanen: z.coerce.number().min(0).max(999999).optional().nullable(),
    pemupukan: z.string().max(2000).optional().nullable().or(z.literal("")),
    pengobatan: z.string().max(2000).optional().nullable().or(z.literal("")),
    status: StatusKesehatanEnum.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Minimal satu field lapangan harus diisi",
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

// Query filter untuk list pohon - 11 field support
export const queryPohonSchema = z.object({
  lokasiBlok: z.string().optional(),
  status: StatusKesehatanEnum.optional(),
  varietas: z.string().optional(),
  namaPohon: z.string().optional(),
  jenis: z.string().optional(),
  koordinat: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

export type CreatePohonInput = z.infer<typeof createPohonSchema>;
export type UpdatePohonInput = z.infer<typeof updatePohonSchema>;
export type UpdatePohonMasterInput = z.infer<typeof updatePohonMasterSchema>;
export type UpdatePohonLapanganInput = z.infer<typeof updatePohonLapanganSchema>;
export type CreateRiwayatInput = z.infer<typeof createRiwayatKesehatanSchema>;
