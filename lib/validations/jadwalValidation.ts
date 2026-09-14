import { z } from "zod";

export const JenisPerawatanEnum = z.enum(["PUPUK", "OBAT", "LAIN"]);
export const StatusJadwalEnum = z.enum(["RENCANA", "SELESAI", "BATAL"]);

export const createJadwalSchema = z.object({
  blok: z.string().min(1, "Blok wajib diisi").max(50),
  pohonId: z.string().max(30).optional().nullable().or(z.literal("")),
  jenis: JenisPerawatanEnum,
  tanggalRencana: z.coerce.date({ message: "Tanggal rencana tidak valid" }),
  catatan: z.string().max(1000).optional().nullable().or(z.literal("")),
});

export const updateJadwalSchema = z.object({
  blok: z.string().min(1).max(50).optional(),
  pohonId: z.string().max(30).optional().nullable().or(z.literal("")),
  jenis: JenisPerawatanEnum.optional(),
  tanggalRencana: z.coerce.date().optional(),
  status: StatusJadwalEnum.optional(),
  catatan: z.string().max(1000).optional().nullable().or(z.literal("")),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Minimal satu field harus diisi untuk update",
});
