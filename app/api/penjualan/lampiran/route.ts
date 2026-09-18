import { NextRequest } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { saveBuktiFiles } from "@/lib/storage";

// POST /api/penjualan/lampiran - upload file lampiran dokumen penjualan (FormData: files[]).
// File hanya disimpan; metadata dikembalikan untuk disertakan saat menyimpan dokumen.
export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const formData = await req.formData();
    const files = formData
      .getAll("files")
      .filter((f): f is File => f instanceof File && f.size > 0);

    if (files.length === 0) return errorResponse("Tidak ada file lampiran yang dikirim", 400);

    const { items, errors } = await saveBuktiFiles(files);

    const message =
      errors.length > 0
        ? `${items.length} file berhasil diupload, ${errors.length} file ditolak`
        : `${items.length} file berhasil diupload`;

    if (items.length === 0) return errorResponse(message, 400, errors);

    return successResponse({ items, errors }, message);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal upload lampiran", 500);
  }
}
