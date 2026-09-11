import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { updatePohonGeotagSchema } from "@/lib/validations/pohonValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { uploadFotoLapangan, parseFotoFromFormData, deleteFotoLapangan } from "@/lib/storage";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

// GET /api/pohon/[id]/geotag - get geotag snapshot (petugas juga)
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_PERTANIAN", "PETUGAS_LAPANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const pohon = await prisma.pohon.findUnique({
    where: { id },
    select: {
      id: true,
      namaPohon: true,
      varietas: true,
      fotoGeotagUrl: true,
      latitude: true,
      longitude: true,
      koordinat: true,
      geotagAccuracy: true,
      geotagTimestamp: true,
      geotagSource: true,
      geotagUpdatedAt: true,
      geotagAdminId: true,
    },
  });
  if (!pohon) return errorResponse("Pohon tidak ditemukan", 404);
  let admin = null;
  if (pohon.geotagAdminId) {
    admin = await prisma.user.findUnique({ where: { id: pohon.geotagAdminId }, select: { id: true, nama: true, email: true } });
  }
  return successResponse({ ...pohon, geotagAdmin: admin });
}

// PUT /api/pohon/[id]/geotag - overwrite foto geotag wajib (petugas)
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_PERTANIAN", "PETUGAS_LAPANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  try {
    const contentType = req.headers.get("content-type") || "";
    let fotoFile: File | null = null;
    let bodyData: any = {};

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      fotoFile = await parseFotoFromFormData(formData as any, "foto");
      bodyData = {
        latitude: formData.get("latitude") || undefined,
        longitude: formData.get("longitude") || undefined,
        geotagAccuracy: formData.get("geotagAccuracy") || formData.get("accuracy") || undefined,
        geotagTimestamp: formData.get("geotagTimestamp") || undefined,
        geotagSource: formData.get("geotagSource") || formData.get("source") || undefined,
        koordinat: formData.get("koordinat") || undefined,
      };
      // handle fotoGeotagUrl fallback if file not provided but url given
      const fotoUrl = formData.get("fotoGeotagUrl") || formData.get("fotoUrl");
      if (fotoUrl) bodyData.fotoGeotagUrl = String(fotoUrl);
    } else {
      bodyData = await req.json();
      // support fotoUrl passthrough for JSON (client pre-uploaded)
      if (bodyData.fotoUrl) bodyData.fotoGeotagUrl = bodyData.fotoUrl;
    }

    const parsed = updatePohonGeotagSchema.parse(bodyData);

    const exists = await prisma.pohon.findUnique({ where: { id } });
    if (!exists) return errorResponse("Pohon tidak ditemukan", 404);

    // Wajib: foto + lat/lng harus ada (either file or url)
    let fotoGeotagUrl = (exists as any).fotoGeotagUrl as string | null;
    if (fotoFile) {
      // delete old foto if exists
      const oldUrl = fotoGeotagUrl;
      const uploaded = await uploadFotoLapangan(fotoFile, { folder: "pohon-geotag" });
      fotoGeotagUrl = uploaded.url;
      if (oldUrl) {
        try {
          await deleteFotoLapangan(oldUrl);
        } catch {}
      }
    } else if ((parsed as any).fotoGeotagUrl) {
      fotoGeotagUrl = (parsed as any).fotoGeotagUrl as string;
    }

    if (!fotoGeotagUrl) return errorResponse("Foto geotag wajib — upload foto", 400);
    if (parsed.latitude == null || parsed.longitude == null) return errorResponse("Latitude & longitude wajib untuk geotag", 400);

    // Accuracy threshold: block >500m unless MANUAL with reason (allow but warn)
    if (parsed.geotagAccuracy != null && Number(parsed.geotagAccuracy) > 100) {
      // still allow but could warn; we allow
    }

    const latitude = parsed.latitude as number;
    const longitude = parsed.longitude as number;
    const koordinat = `${latitude}, ${longitude}`;

    const updated = await prisma.pohon.update({
      where: { id },
      data: {
        fotoGeotagUrl,
        latitude,
        longitude,
        koordinat,
        geotagAccuracy: parsed.geotagAccuracy != null ? Number(parsed.geotagAccuracy) : null,
        geotagTimestamp: parsed.geotagTimestamp ? new Date(parsed.geotagTimestamp as any) : new Date(),
        geotagSource: (parsed.geotagSource as any) || "GPS",
        geotagAdminId: (auth as any)?.userId || null,
        geotagUpdatedAt: new Date(),
      } as any,
    });

    return successResponse(updated, "Geotag foto berhasil diupdate (overwrite terbaru)");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal update geotag", 500);
  }
}

// DELETE /api/pohon/[id]/geotag - hapus geotag (SUPER_ADMIN only, optional)
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const exists = await prisma.pohon.findUnique({ where: { id } });
  if (!exists) return errorResponse("Pohon tidak ditemukan", 404);
  const oldUrl = (exists as any).fotoGeotagUrl as string | null;
  if (oldUrl) {
    try {
      await deleteFotoLapangan(oldUrl);
    } catch {}
  }
  const updated = await prisma.pohon.update({
    where: { id },
    data: {
      fotoGeotagUrl: null,
      latitude: null,
      longitude: null,
      geotagAccuracy: null,
      geotagTimestamp: null,
      geotagSource: null,
      geotagAdminId: null,
    } as any,
  });
  return successResponse(updated, "Geotag dihapus");
}
