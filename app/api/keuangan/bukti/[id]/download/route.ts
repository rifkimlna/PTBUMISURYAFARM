import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { errorResponse } from "@/lib/api-response";
import { resolveBuktiFilePath } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

// GET /api/keuangan/bukti/[id]/download - unduh file bukti dengan nama file asli
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(_req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const bukti = await prisma.buktiTransaksi.findUnique({ where: { id } });
  if (!bukti) return errorResponse("Bukti tidak ditemukan", 404);

  const absolute = resolveBuktiFilePath(bukti.fileUrl);
  if (!absolute) return errorResponse("Path file tidak valid", 400);

  try {
    const data = await readFile(absolute);
    const ascii = bukti.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    return new NextResponse(data, {
      headers: {
        "Content-Type": bukti.fileType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(bukti.fileName)}`,
        "Content-Length": String(data.byteLength),
        "Cache-Control": "private, max-age=0",
      },
    });
  } catch {
    return errorResponse("File tidak ditemukan di storage", 404);
  }
}