import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { saveBuktiFiles } from "@/lib/storage";

// GET /api/keuangan/bukti?transaksiId=xxx - daftar bukti sebuah transaksi
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const transaksiId = searchParams.get("transaksiId");
    if (!transaksiId) return errorResponse("Parameter transaksiId wajib diisi", 400);

    const exists = await prisma.transaksiKas.findUnique({ where: { id: transaksiId } });
    if (!exists) return errorResponse("Transaksi tidak ditemukan", 404);

    const items = await prisma.buktiTransaksi.findMany({
      where: { transaksiId },
      orderBy: { createdAt: "asc" },
    });
    return successResponse(items);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil bukti", 500);
  }
}

// POST /api/keuangan/bukti - upload satu/banyak file bukti (FormData: files[])
//   transaksiId opsional: jika ada, file langsung dikaitkan ke transaksi.
//   Jika tidak, hanya disimpan dan metadata dikembalikan untuk disimpan bersama transaksi baru.
// Handling per-file: file yang bermasalah ditolak, file lain tetap diproses.
export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const formData = await req.formData();
    const files = formData
      .getAll("files")
      .filter((f): f is File => f instanceof File && f.size > 0);
    const transaksiId = (formData.get("transaksiId") as string | null) || null;

    if (files.length === 0) return errorResponse("Tidak ada file bukti yang dikirim", 400);

    if (transaksiId) {
      const exists = await prisma.transaksiKas.findUnique({ where: { id: transaksiId } });
      if (!exists) return errorResponse("Transaksi tidak ditemukan", 404);
    }

    const { items, errors } = await saveBuktiFiles(files);

    let saved: typeof items = items;
    if (transaksiId && items.length > 0) {
      await prisma.buktiTransaksi.createMany({
        data: items.map((item) => ({
          transaksiId,
          fileName: item.fileName,
          fileUrl: item.fileUrl,
          fileType: item.fileType,
          fileSize: item.fileSize,
        })),
      });
      saved = await prisma.buktiTransaksi.findMany({
        where: { transaksiId },
        orderBy: { createdAt: "asc" },
      });
    }

    const message =
      errors.length > 0
        ? `${items.length} file berhasil diupload, ${errors.length} file ditolak`
        : `${items.length} file berhasil diupload`;

    if (items.length === 0) return errorResponse(message, 400, errors);

    return successResponse({ items: saved, errors }, message);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal upload bukti", 500);
  }
}