import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { updatePohonLapanganSchema } from "@/lib/validations/pohonValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

// GET /api/pohon/[id]/lapangan - get lapangan snapshot + riwayat count
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_PERTANIAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const pohon = await prisma.pohon.findUnique({
    where: { id },
    select: {
      id: true,
      namaPohon: true,
      varietas: true,
      jenis: true,
      lokasiBlok: true,
      koordinat: true,
      hasilPanen: true,
      pemupukan: true,
      pengobatan: true,
      status: true,
      tanggalTanam: true,
      _count: { select: { riwayat: true } },
    },
  });
  if (!pohon) return errorResponse("Pohon tidak ditemukan", 404);
  return successResponse(pohon);
}

// PUT /api/pohon/[id]/lapangan - update (tanpa login demo)
export async function PUT(req: NextRequest, { params }: Params) {
  // tanpa login untuk demo tambah data
  const session = await getSessionFromRequest(req);
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updatePohonLapanganSchema.parse(body);
    const exists = await prisma.pohon.findUnique({ where: { id } });
    if (!exists) return errorResponse("Pohon tidak ditemukan", 404);

    const data: any = {};
    if (parsed.hasilPanen !== undefined) data.hasilPanen = parsed.hasilPanen as any;
    if (parsed.pemupukan !== undefined) data.pemupukan = (parsed.pemupukan as string) === "" ? null : parsed.pemupukan;
    if (parsed.pengobatan !== undefined) data.pengobatan = (parsed.pengobatan as string) === "" ? null : parsed.pengobatan;
    if (parsed.status !== undefined) data.status = parsed.status;

    const updated = await prisma.pohon.update({ where: { id }, data });

    // Create Panen history if hasilPanen changed and not null
    try {
      if (parsed.hasilPanen !== undefined && parsed.hasilPanen !== null && (parsed.hasilPanen as any) !== "" && Number(parsed.hasilPanen) > 0) {
        const prev = exists.hasilPanen ? Number(exists.hasilPanen) : 0;
        const next = Number(parsed.hasilPanen);
        if (next !== prev) {
          await prisma.panen.create({
            data: {
              pohonId: id,
              jumlahKg: next as any,
              petugasId: session?.userId ?? null,
              catatan: `Update via lapangan: ${prev} -> ${next} KG`,
            },
          });
        }
      }
    } catch (e) {
      console.error("[Panen create]", e);
      // don't fail main update
    }

    return successResponse(updated, "Data lapangan berhasil diupdate");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal update lapangan", 500);
  }
}
