import { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { createKontakSchema, TipeKontakEnum } from "@/lib/validations/kontakValidation";
import { ensurePelangganForKontak, ensureSupplierForKontak, generateKodeKaryawan } from "@/lib/kontak-sync";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";

const querySchema = z.object({
  q: z.string().optional(),
  tipe: TipeKontakEnum.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100).optional(),
});

// GET /api/kontak - daftar kontak master (SUPER_ADMIN, ADMIN_KEUANGAN)
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const query = querySchema.parse({
      q: searchParams.get("q") || undefined,
      tipe: searchParams.get("tipe") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    const where: {
      tipe?: "PELANGGAN" | "SUPPLIER" | "KARYAWAN";
      OR?: Array<Record<string, { contains: string; mode: "insensitive" }>>;
    } = {};
    if (query.tipe) where.tipe = query.tipe;
    if (query.q) {
      where.OR = [
        { nama: { contains: query.q, mode: "insensitive" } },
        { perusahaan: { contains: query.q, mode: "insensitive" } },
        { email: { contains: query.q, mode: "insensitive" } },
        { noHp: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const data = await prisma.kontak.findMany({
      where,
      orderBy: { nama: "asc" },
      take: query.limit ?? 100,
    });

    return successResponse(data);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil kontak", 500);
  }
}

// POST /api/kontak - tambah kontak master (tanpa login demo)
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  void session;

  try {
    const body = await req.json();
    const parsed = createKontakSchema.parse(body);

    // Karyawan: satu-satunya sumber data karyawan adalah Kontak tipe KARYAWAN.
    // ID otomatis (EMP-...) bila kosong; tolak bila menabrak ID yang sudah ada.
    let karyawanData = {};
    if (parsed.tipe === "KARYAWAN") {
      const kode = parsed.kodeKaryawan?.toUpperCase() ?? (await generateKodeKaryawan(prisma));
      const [tabrakanKontak, tabrakanArsip] = await Promise.all([
        prisma.kontak.findUnique({ where: { kodeKaryawan: kode }, select: { id: true } }),
        prisma.karyawan.findUnique({ where: { id: kode }, select: { id: true } }),
      ]);
      if (tabrakanKontak || tabrakanArsip) {
        return errorResponse(`ID karyawan ${kode} sudah dipakai`, 409);
      }
      karyawanData = {
        kodeKaryawan: kode,
        jabatan: parsed.jabatan ?? null,
        statusKerja: parsed.statusKerja ?? null,
        lokasiKerja: parsed.lokasiKerja ?? null,
        tanggalMasuk: parsed.tanggalMasuk ?? null,
        gajiPokok: parsed.gajiPokok ?? null,
        tanggalLahir: parsed.tanggalLahir ?? null,
        jenisKelamin: parsed.jenisKelamin ?? null,
      };
    }

    const kontak = await prisma.kontak.create({
      data: {
        nama: parsed.nama,
        tipe: parsed.tipe,
        perusahaan: parsed.perusahaan ?? null,
        email: parsed.email?.trim() || null,
        noHp: parsed.noHp ?? null,
        noTelepon: parsed.noTelepon ?? null,
        alamat: parsed.alamat ?? null,
        catatan: parsed.catatan ?? null,
        ...karyawanData,
      },
    });

    // Dua arah: Kontak PELANGGAN/SUPPLIER otomatis tersedia di dropdown
    // Penjualan / Pembelian (buat pasangannya bila belum ada).
    try {
      if (kontak.tipe === "PELANGGAN") {
        await ensurePelangganForKontak(prisma, kontak);
      } else if (kontak.tipe === "SUPPLIER") {
        await ensureSupplierForKontak(prisma, kontak);
      }
    } catch {
      // abaikan
    }

    return successResponse(kontak, "Kontak berhasil ditambahkan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal tambah kontak", 500);
  }
}
