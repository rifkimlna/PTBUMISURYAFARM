import { z } from "zod";

export const TipeKontakEnum = z.enum(["PELANGGAN", "SUPPLIER", "KARYAWAN"]);
export type TipeKontak = z.infer<typeof TipeKontakEnum>;
// Catatan: nilai DB "LAINNYA" (enum Prisma TipeKontak) dipertahankan di
// database agar baris lama tidak rusak, tetapi tidak lagi ditawarkan di UI
// maupun diterima API create/update.

// Disalin dari aturan Data Karyawan lama (satu-satunya sumber kini Kontak).
export const StatusKerjaKontakEnum = z.enum(["TETAP", "TIDAK_TETAP", "PENDUKUNG"]);
export const JenisKelaminKontakEnum = z.enum(["LAKI_LAKI", "PEREMPUAN"]);

const emailOptional = z
  .string()
  .trim()
  .max(100, "Email maksimal 100 karakter")
  .optional()
  .nullable()
  .refine((v) => !v || /.+@.+\..+/.test(v), {
    message: "Format email tidak valid",
  });

// Field opsional: string kosong dari form dinormalisasi menjadi null.
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter`)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null));

const optionalPhone = (label: string) =>
  z
    .string()
    .trim()
    .max(30, `${label} maksimal 30 karakter`)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null));

export const createKontakSchema = z.object({
  nama: z.string().trim().min(2, "Nama kontak minimal 2 karakter").max(100, "Nama kontak maksimal 100 karakter"),
  tipe: TipeKontakEnum,
  perusahaan: optionalText(100, "Nama perusahaan"),
  email: emailOptional,
  noHp: optionalPhone("No. handphone"),
  noTelepon: optionalPhone("No. telepon"),
  alamat: optionalText(1000, "Alamat"),
  catatan: optionalText(1000, "Catatan"),
  // --- Khusus Karyawan (diisi bila tipe = KARYAWAN; diabaikan untuk tipe lain) ---
  kodeKaryawan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^EMP-\d{3,}$/, "ID karyawan harus format EMP-001")
    .optional()
    .nullable(),
  jabatan: optionalText(50, "Jabatan"),
  statusKerja: StatusKerjaKontakEnum.optional().nullable(),
  lokasiKerja: optionalText(100, "Lokasi kerja"),
  tanggalMasuk: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.date({ message: "Tanggal masuk tidak valid" }).optional().nullable()
  ),
  gajiPokok: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce
      .number({ message: "Gaji pokok harus angka" })
      .min(0, "Gaji tidak boleh negatif")
      .max(100_000_000, "Gaji terlalu besar")
      .optional()
      .nullable()
  ),
  tanggalLahir: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.date({ message: "Tanggal lahir tidak valid" }).optional().nullable()
  ),
  jenisKelamin: JenisKelaminKontakEnum.optional().nullable(),
});

export const updateKontakSchema = createKontakSchema.partial().extend({
  nama: z
    .string()
    .trim()
    .min(2, "Nama kontak minimal 2 karakter")
    .max(100, "Nama kontak maksimal 100 karakter")
    .optional(),
});
