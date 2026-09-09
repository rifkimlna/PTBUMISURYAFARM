import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken } from "@/lib/auth";
import { loginSchema } from "@/lib/validations/authValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

// POST /api/auth/login
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { email } });
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
      role: user.role as any,
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
    console.error("[Login]", e);
    return errorResponse(e instanceof Error ? e.message : "Gagal login", 500);
  }
}
