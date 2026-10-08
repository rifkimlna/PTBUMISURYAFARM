import { NextRequest } from "next/server";
import { prisma, isDbConnectionError, dbUnreachableMessage } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

// GET /api/auth/me - cek sesi
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return errorResponse("Unauthorized - belum login", 401);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, nama: true, email: true, role: true, createdAt: true },
    });

    if (!user) return errorResponse("User tidak ditemukan", 404);

    return successResponse({ user, session }, "Sesi valid");
  } catch (e) {
    // DB down bukan berarti token invalid: kembalikan sesi dari JWT
    // (success + dbDown) agar layout client tidak me-redirect ke /login,
    // melainkan tampilkan banner dan pertahankan sesi.
    console.error("[api/auth/me] database tidak terjangkau:", e instanceof Error ? e.message : e);
    if (isDbConnectionError(e)) {
      return successResponse(
        {
          user: { id: session.userId, nama: session.nama, email: session.email, role: session.role },
          session,
          dbDown: true,
        },
        "Sesi valid (database tidak terjangkau, data dari token)",
      );
    }
    return errorResponse(dbUnreachableMessage(), 503);
  }
}
