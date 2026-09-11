import { z } from "zod";

export const RoleEnum = z.enum(["SUPER_ADMIN", "ADMIN_PERTANIAN", "ADMIN_KEUANGAN", "PETUGAS_LAPANGAN"]);

export const registerSchema = z.object({
  nama: z.string().min(3).max(100),
  email: z.string().email("Email tidak valid").max(100),
  password: z.string().min(8, "Password minimal 8 karakter").max(100),
  role: RoleEnum,
});

export const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
