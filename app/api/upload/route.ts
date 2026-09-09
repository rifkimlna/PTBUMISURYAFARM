import { NextRequest } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { uploadFotoLapangan } from "@/lib/storage";
import { successResponse, errorResponse } from "@/lib/api-response";

// POST /api/upload - upload foto lapangan (tanpa login demo)
export async function POST(req: NextRequest) {

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "umum";

    if (!file || !(file instanceof File) || file.size === 0) {
      return errorResponse("File tidak ditemukan - field 'file' wajib", 400);
    }

    const result = await uploadFotoLapangan(file, { folder });

    return successResponse(result, "Upload berhasil", 201);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal upload", 500);
  }
}
