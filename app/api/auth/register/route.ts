import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";
import { registerSchema } from "@/lib/validations/authValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

// POST /api/auth/register - hanya SUPER_ADMIN yang bisa buat user baru (atau self-register terbatas)
// Untuk setup awal, izinkan tanpa auth jika belum ada SUPER_ADMIN
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nama, email, password, role } = registerSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return errorResponse("Email sudah terdaftar", 409);
    }

    // Cek apakah ini user pertama? Jika belum ada SUPER_ADMIN, izinkan tanpa token
    const superAdminExists = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
    if (superAdminExists) {
      // Wajib SUPER_ADMIN untuk buat user baru setelah bootstrap
      const { getSessionFromRequest } = await import("@/lib/auth");
      const session = await getSessionFromRequest(req);
      if (!session || session.role !== "SUPER_ADMIN") {
        return errorResponse("Forbidden - hanya SUPER_ADMIN bisa mendaftarkan user baru", 403);
      }
    }

    const hashed = await hashPassword(password);

    const user = await prisma.user.create({
      data: { nama, email, password: hashed, role },
      select: { id: true, nama: true, email: true, role: true, createdAt: true },
    });

    // Auto login - kembalikan token
    const token = await signToken({
      userId: user.id,
      email: user.email,
      nama: user.nama,
      role: user.role as any,
    });

    return successResponse({ user, token }, "Registrasi berhasil", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    console.error("[Register]", e);
    return errorResponse(e instanceof Error ? e.message : "Gagal registrasi", 500);
  }
}
