import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

// GET /api/auth/me - cek sesi
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return errorResponse("Unauthorized - belum login", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, nama: true, email: true, role: true, createdAt: true },
  });

  if (!user) return errorResponse("User tidak ditemukan", 404);

  return successResponse({ user, session }, "Sesi valid");
}
