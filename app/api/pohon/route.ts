import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { createPohonSchema, queryPohonSchema } from "@/lib/validations/pohonValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { uploadFotoLapangan, parseFotoFromFormData } from "@/lib/storage";
import { ZodError } from "zod";

// GET /api/pohon - list (SUPER_ADMIN, ADMIN_PERTANIAN)
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_PERTANIAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const query = queryPohonSchema.parse({
      lokasiBlok: searchParams.get("lokasiBlok") || undefined,
      status: searchParams.get("status") || undefined,
      varietas: searchParams.get("varietas") || undefined,
      namaPohon: searchParams.get("namaPohon") || undefined,
      jenis: searchParams.get("jenis") || undefined,
      koordinat: searchParams.get("koordinat") || undefined,
      hasGeotag: (searchParams.get("hasGeotag") as any) || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.lokasiBlok) where.lokasiBlok = { contains: query.lokasiBlok, mode: "insensitive" };
    if (query.status) where.status = query.status;
    if (query.varietas) where.varietas = { contains: query.varietas, mode: "insensitive" };
    if (query.namaPohon) where.namaPohon = { contains: query.namaPohon, mode: "insensitive" };
    if (query.jenis) where.jenis = { contains: query.jenis, mode: "insensitive" };
    if (query.koordinat) where.koordinat = { contains: query.koordinat, mode: "insensitive" };
    if ((query as any).hasGeotag === "true") where.fotoGeotagUrl = { not: null };
    if ((query as any).hasGeotag === "false") where.fotoGeotagUrl = null;

    const [data, total] = await Promise.all([
      prisma.pohon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { riwayat: true } } },
      }),
      prisma.pohon.count({ where }),
    ]);

    return successResponse(
      { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      "Daftar pohon"
    );
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil data pohon", 500);
  }
}

// POST /api/pohon - create (SUPER_ADMIN, ADMIN_PERTANIAN)
export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_PERTANIAN"]);
  if (auth instanceof Response) return auth;

  try {
    const contentType = req.headers.get("content-type") || "";
    let parsed: any;
    let fotoGeotagUrl: string | null = null;
    let latitude: number | null = null;
    let longitude: number | null = null;
    let geotagAccuracy: number | null = null;
    let geotagSource: string | null = null;
    let geotagTimestamp: Date | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const fotoFile = await parseFotoFromFormData(formData as any, "foto");
      const fotoFile2 = await parseFotoFromFormData(formData as any, "fotoGeotag");
      const file = fotoFile || fotoFile2;
      const body: any = {
        id: formData.get("id"),
        namaPohon: formData.get("namaPohon"),
        varietas: formData.get("varietas"),
        jenis: formData.get("jenis"),
        lokasiBlok: formData.get("lokasiBlok"),
        tanggalTanam: formData.get("tanggalTanam"),
        koordinat: formData.get("koordinat"),
        hasilPanen: formData.get("hasilPanen"),
        pemupukan: formData.get("pemupukan"),
        pengobatan: formData.get("pengobatan"),
        status: formData.get("status"),
      };
      // clean empty strings
      for (const k in body) if (body[k] === "" || body[k] === null) body[k] = undefined;
      parsed = createPohonSchema.parse(body);

      // Geotag wajib untuk multipart (UI wajib)
      if (!file) return errorResponse("Foto geotag wajib — upload foto pohon", 400);
      const lat = formData.get("latitude") || formData.get("lat");
      const lng = formData.get("longitude") || formData.get("lng");
      if (!lat || !lng) return errorResponse("Latitude & longitude wajib untuk geotag", 400);
      latitude = Number(lat);
      longitude = Number(lng);
      if (Number.isNaN(latitude) || Number.isNaN(longitude)) return errorResponse("Koordinat tidak valid", 400);
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return errorResponse("Koordinat out of range", 400);
      const acc = formData.get("geotagAccuracy") || formData.get("accuracy");
      if (acc) geotagAccuracy = Number(acc);
      const src = formData.get("geotagSource") || formData.get("source");
      if (src) geotagSource = String(src).toUpperCase();
      else geotagSource = "GPS";
      const ts = formData.get("geotagTimestamp");
      geotagTimestamp = ts ? new Date(String(ts)) : new Date();

      const uploaded = await uploadFotoLapangan(file, { folder: "pohon-geotag" });
      fotoGeotagUrl = uploaded.url;
    } else {
      const body = await req.json();
      parsed = createPohonSchema.parse(body);
      // JSON mode: allow without geotag for backward compat (seed, tests), but UI will use multipart
      if (body.latitude != null && body.longitude != null) {
        latitude = Number(body.latitude);
        longitude = Number(body.longitude);
        fotoGeotagUrl = body.fotoGeotagUrl || body.fotoUrl || null;
        geotagAccuracy = body.geotagAccuracy != null ? Number(body.geotagAccuracy) : null;
        geotagSource = body.geotagSource || "MANUAL";
        geotagTimestamp = body.geotagTimestamp ? new Date(body.geotagTimestamp) : null;
      }
    }

    const exists = await prisma.pohon.findUnique({ where: { id: parsed.id } });
    if (exists) {
      if (fotoGeotagUrl) {
        try {
          // no old to delete on create
        } catch {}
      }
      return errorResponse(`ID pohon ${parsed.id} sudah ada`, 409);
    }

    const koordinatFinal = latitude != null && longitude != null ? `${latitude}, ${longitude}` : ((parsed.koordinat as string) || null);

    const pohon = await prisma.pohon.create({
      data: {
        id: parsed.id,
        namaPohon: (parsed.namaPohon as string) || null,
        varietas: parsed.varietas,
        jenis: (parsed.jenis as string) || null,
        lokasiBlok: parsed.lokasiBlok,
        tanggalTanam: parsed.tanggalTanam,
        koordinat: koordinatFinal,
        hasilPanen: (parsed.hasilPanen as any) ?? null,
        pemupukan: (parsed.pemupukan as string) || null,
        pengobatan: (parsed.pengobatan as string) || null,
        status: parsed.status as any,
        ...(fotoGeotagUrl
          ? {
              fotoGeotagUrl,
              latitude,
              longitude,
              geotagAccuracy,
              geotagSource: geotagSource as any,
              geotagTimestamp,
              geotagAdminId: (auth as any).userId,
            }
          : {}),
      } as any,
    });

    return successResponse(pohon, "Pohon berhasil ditambahkan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal tambah pohon", 500);
  }
}
