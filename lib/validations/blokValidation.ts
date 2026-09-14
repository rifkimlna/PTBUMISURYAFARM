import { z } from "zod";

export const createBlokSchema = z.object({
  kode: z
    .string()
    .min(1, "Kode wajib diisi")
    .max(10)
    .transform((s) => s.trim().toUpperCase()),
  nama: z.string().min(2, "Nama minimal 2 karakter").max(50),
  luasHa: z.coerce.number().min(0, "Luas minimal 0").max(100000).optional().nullable(),
});

export const updateBlokSchema = z.object({
  nama: z.string().min(2).max(50).optional(),
  luasHa: z.coerce.number().min(0).max(100000).optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Minimal satu field harus diisi untuk update",
});
