import { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { uploadFotoLapangan } from "@/lib/storage";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";

const lamarSchema = z.object({
  lowonganId: z.string().min(1),
  nama: z.string().min(3),
  email: z.string().email(),
  wa: z.string().min(8),
});

// POST /api/karir/lamar - kirim lamaran (publik, multipart/form-data)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const raw = {
      lowonganId: String(formData.get("lowonganId") || ""),
      nama: String(formData.get("nama") || ""),
      email: String(formData.get("email") || ""),
      wa: String(formData.get("wa") || ""),
    };
    const data = lamarSchema.parse(raw);

    const file = formData.get("cv");
    if (!file || !(file instanceof File) || file.size === 0) {
      return errorResponse("CV wajib diunggah (PDF)", 400);
    }

    const lowongan = await prisma.lowongan.findFirst({
      where: { id: data.lowonganId, isActive: true },
    });
    if (!lowongan) return errorResponse("Lowongan tidak ditemukan atau sudah ditutup", 404);

    // Reuse storage helper (Supabase di production, local disk di dev) - khusus PDF, maks 5MB
    const result = await uploadFotoLapangan(file, {
      folder: "cv",
      maxSizeMB: 5,
      allowedTypes: ["application/pdf"],
    });

    const pelamar = await prisma.pelamar.create({
      data: {
        lowonganId: lowongan.id,
        nama: data.nama,
        email: data.email,
        wa: data.wa,
        cvUrl: result.url,
        tipe: lowongan.tipe,
      },
    });

    return successResponse(pelamar, "Lamaran terkirim. Kami akan menghubungi Anda via WhatsApp atau email.", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal mengirim lamaran", 500);
  }
}
