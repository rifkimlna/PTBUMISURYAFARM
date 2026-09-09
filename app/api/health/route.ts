import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const counts = {
      users: await prisma.user.count(),
      pohon: await prisma.pohon.count(),
      karyawan: await prisma.karyawan.count(),
      transaksi: await prisma.transaksiKas.count(),
    };
    return successResponse({ db: "pt_bst", status: "connected", counts }, "Health OK");
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "DB error", 500);
  }
}
