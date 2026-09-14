import { z } from "zod";

export const createPanenSchema = z.object({
  pohonId: z
    .string()
    .min(3, "ID pohon wajib diisi")
    .max(30)
    .transform((s) => s.trim().toUpperCase()),
  tanggalPanen: z.coerce.date({ message: "Tanggal panen tidak valid" }).optional(),
  jumlahKg: z.coerce.number({ message: "Jumlah KG harus angka" }).positive("Jumlah KG harus lebih dari 0").max(999999),
  catatan: z.string().max(500).optional().nullable().or(z.literal("")),
});
