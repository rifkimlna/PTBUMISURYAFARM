import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { deleteBuktiFile } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(_req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const bukti = await prisma.buktiTransaksi.findUnique({ where: { id } });
  if (!bukti) return errorResponse("Bukti tidak ditemukan", 404);

  await prisma.buktiTransaksi.delete({ where: { id } });
  await deleteBuktiFile(bukti.fileUrl);

  return successResponse(null, "Bukti dihapus");
}