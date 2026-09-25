import { z } from "zod";

export const StatusGudangEnum = z.enum(["AKTIF", "NONAKTIF"]);

const emptyToNull = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter`)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null));

export const createGudangSchema = z.object({
  kode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^GDG-\d{3,}$/, "Kode harus format GDG-001")
    .optional()
    .nullable(),
  nama: z.string().trim().min(2, "Nama gudang minimal 2 karakter").max(100, "Nama gudang maksimal 100 karakter"),
  alamat: emptyToNull(500, "Alamat"),
  status: StatusGudangEnum.optional().nullable(),
});

export const updateGudangSchema = z
  .object({
    nama: z.string().trim().min(2, "Nama gudang minimal 2 karakter").max(100).optional(),
    alamat: emptyToNull(500, "Alamat"),
    status: StatusGudangEnum.optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Minimal satu field harus diisi",
  });
