import { NextRequest } from "next/server";
import { prisma, isDbConnectionError, dbUnreachableMessage } from "@/lib/prisma";
import { verifyPassword, signToken, type Role } from "@/lib/auth";
import { loginSchema } from "@/lib/validations/authValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

// POST /api/auth/login
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    // Fail-fast bila env belum diisi (kasus umum di Vercel: .env tidak ikut deploy).
    if (!process.env.DATABASE_URL) {
      return errorResponse(dbUnreachableMessage(), 503);
    }

    let user: { id: string; nama: string; email: string; password: string; role: string } | null;
    try {
      user = await prisma.user.findUnique({ where: { email } });
    } catch (e) {
      if (isDbConnectionError(e)) {
        console.error("[Login] database tidak terjangkau:", e instanceof Error ? e.message : e);
        return errorResponse(dbUnreachableMessage(), 503);
      }
      throw e;
    }
    if (!user) {
      return errorResponse("Email atau password salah", 401);
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return errorResponse("Email atau password salah", 401);
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      nama: user.nama,
      role: user.role as Role,
    });

    const response = successResponse(
      {
        user: { id: user.id, nama: user.nama, email: user.email, role: user.role },
        token,
      },
      "Login berhasil"
    );

    // Set httpOnly cookie juga untuk middleware
    response.cookies.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 hari
      path: "/",
    });

    return response;
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    if (isDbConnectionError(e)) {
      console.error("[Login] database tidak terjangkau:", e instanceof Error ? e.message : e);
      return errorResponse(dbUnreachableMessage(), 503);
    }
    console.error("[Login]", e);
    return errorResponse(e instanceof Error ? e.message : "Gagal login", 500);
  }
}
