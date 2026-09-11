import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { createRiwayatKesehatanSchema } from "@/lib/validations/pohonValidation";
import { uploadFotoLapangan, parseFotoFromFormData } from "@/lib/storage";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

/**
 * CONTOH IMPLEMENTASI LENGKAP - SESUAI REQUEST USER
 * POST /api/pohon/[id]/riwayat
 * - Validasi Zod
 * - Pengecekan role (SUPER_ADMIN, ADMIN_PERTANIAN)
 * - Upload foto -> cloud -> fotoUrl -> save DB
 */

// GET /api/pohon/[id]/riwayat - list riwayat kesehatan 1 pohon
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_PERTANIAN", "PETUGAS_LAPANGAN"]);
  if (auth instanceof Response) return auth;

  const { id: pohonId } = await params;

  const pohon = await prisma.pohon.findUnique({ where: { id: pohonId } });
  if (!pohon) return errorResponse("Pohon tidak ditemukan", 404);

  const riwayat = await prisma.riwayatKesehatan.findMany({
    where: { pohonId },
    orderBy: { tanggalCek: "desc" },
    include: { petugas: { select: { id: true, nama: true, email: true, role: true } } },
  });

  return successResponse(riwayat, `Riwayat kesehatan ${pohonId}`);
}

// POST /api/pohon/[id]/riwayat - tambah riwayat (petugas lapangan)
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_PERTANIAN", "PETUGAS_LAPANGAN"]);
  if (auth instanceof Response) return auth;
  const session = auth;

  const { id: pohonId } = await params;

  // 2. CEK POHON EXIST
  const pohon = await prisma.pohon.findUnique({ where: { id: pohonId } });
  if (!pohon) return errorResponse(`Pohon ${pohonId} tidak ditemukan`, 404);

  try {
    let gejala: string;
    let tindakan: string;
    let fotoUrl: string | null = null;
    let tanggalCek: Date | undefined;

    const contentType = req.headers.get("content-type") || "";

    // 3. PARSE INPUT - dukung JSON dan FormData
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      gejala = String(formData.get("gejala") || "");
      tindakan = String(formData.get("tindakan") || "");
      const tanggalRaw = formData.get("tanggalCek");
      if (tanggalRaw) tanggalCek = new Date(String(tanggalRaw));

      // 4. HANDLE UPLOAD FOTO -> CLOUD -> URL
      const file = await parseFotoFromFormData(formData, "foto");
      if (file) {
        // Upload ke Cloud Storage (Supabase / UploadThing / Simulated)
        const result = await uploadFotoLapangan(file, { folder: "riwayat-kesehatan" });
        fotoUrl = result.url;
        console.log(`[Upload] Foto berhasil di-upload via ${result.provider}: ${result.url}`);
      } else {
        // Jika tidak ada file tapi ada fotoUrl manual
        const urlRaw = formData.get("fotoUrl");
        if (urlRaw) fotoUrl = String(urlRaw);
      }
    } else {
      // JSON mode
      const body = await req.json();
      gejala = body.gejala;
      tindakan = body.tindakan;
      fotoUrl = body.fotoUrl || null;
      if (body.tanggalCek) tanggalCek = new Date(body.tanggalCek);
    }

    // 5. VALIDASI ZOD - sebelum masuk DB
    const validated = createRiwayatKesehatanSchema.parse({
      gejala,
      tindakan,
      fotoUrl: fotoUrl || undefined,
      tanggalCek,
    });

    // 6. SIMPAN KE DB - fotoUrl adalah URL publik cloud
    const petugasId = (auth as any).userId as string;
    const riwayat = await prisma.riwayatKesehatan.create({
      data: {
        pohonId,
        gejala: validated.gejala,
        tindakan: validated.tindakan,
        fotoUrl: validated.fotoUrl || null,
        tanggalCek: validated.tanggalCek ?? new Date(),
        petugasId,
      },
      include: {
        pohon: { select: { id: true, varietas: true, lokasiBlok: true } },
        petugas: { select: { id: true, nama: true, email: true } },
      },
    });

    // 7. OPTIONAL: update status pohon otomatis jika gejala berat
    // (contoh logic bisnis - bisa diaktifkan)
    // if (validated.gejala.toLowerCase().includes("mati")) {
    //   await prisma.pohon.update({ where: { id: pohonId }, data: { status: "MATI" } });
    // }

    return successResponse(riwayat, "Riwayat kesehatan berhasil ditambahkan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    console.error("[POST /api/pohon/[id]/riwayat]", e);
    return errorResponse(e instanceof Error ? e.message : "Gagal tambah riwayat", 500);
  }
}
