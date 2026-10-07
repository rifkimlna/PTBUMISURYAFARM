import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  zodErrorResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { z } from "zod";
import { bulanPeriode } from "../route";

const itemSchema = z.object({
  kodeAkun: z.string().min(1).max(10),
  tahun: z.number().int().min(2000).max(2100),
  bulan: z.number().int().min(1).max(12),
  nominal: z.number().finite().min(0).max(1e15),
});

const updateSchema = z.object({
  nama: z.string().min(2, "Nama anggaran minimal 2 karakter").max(100).optional(),
  items: z.array(itemSchema).max(5000).optional(),
});

const KODE_NON_LABA_RUGI = new Set(["4105"]);

// GET /api/keuangan/anggaran-laba-rugi/[id] - detail + item
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    const data = await prisma.anggaranLabaRugi.findUnique({
      where: { id },
      include: {
        items: { select: { kodeAkun: true, tahun: true, bulan: true, nominal: true } },
        createdBy: { select: { nama: true } },
      },
    });
    if (!data) return notFoundResponse("Anggaran tidak ditemukan");
    return successResponse({
      ...data,
      items: data.items.map((i) => ({ ...i, nominal: Number(i.nominal) })),
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil anggaran", 500);
  }
}

// PUT /api/keuangan/anggaran-laba-rugi/[id] - ubah nama / nilai anggaran
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.parse(body);

    const header = await prisma.anggaranLabaRugi.findUnique({ where: { id } });
    if (!header) return notFoundResponse("Anggaran tidak ditemukan");

    if (parsed.items) {
      const periode = new Set(
        bulanPeriode(header.tahunMulai, header.bulanMulai, header.durasi).map((b) => `${b.tahun}-${b.bulan}`)
      );
      for (const it of parsed.items) {
        if (!periode.has(`${it.tahun}-${it.bulan}`)) {
          return errorResponse(`Item ${it.kodeAkun} di luar periode anggaran`, 400);
        }
        if (KODE_NON_LABA_RUGI.has(it.kodeAkun)) {
          return errorResponse(`Akun ${it.kodeAkun} bukan akun laba rugi`, 400);
        }
      }
      const kodes = [...new Set(parsed.items.map((i) => i.kodeAkun))];
      if (kodes.length > 0) {
        const akun = await prisma.akunCOA.findMany({
          where: { kode: { in: kodes } },
          select: { kode: true, kelompok: true, isActive: true },
        });
        const map = new Map(akun.map((a) => [a.kode, a]));
        for (const k of kodes) {
          const a = map.get(k);
          if (!a) return errorResponse(`Akun ${k} tidak terdaftar di Daftar Akun`, 400);
          if (a.kelompok !== "Pendapatan" && a.kelompok !== "Beban") {
            return errorResponse(`Akun ${k} bukan akun Pendapatan/Beban`, 400);
          }
          if (!a.isActive) return errorResponse(`Akun ${k} sudah nonaktif`, 400);
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      if (parsed.nama !== undefined) {
        await tx.anggaranLabaRugi.update({ where: { id }, data: { nama: parsed.nama.trim() } });
      }
      if (parsed.items) {
        await tx.anggaranItem.deleteMany({ where: { anggaranId: id } });
        const nonzero = parsed.items.filter((i) => i.nominal > 0);
        if (nonzero.length > 0) {
          await tx.anggaranItem.createMany({
            data: nonzero.map((i) => ({
              anggaranId: id,
              kodeAkun: i.kodeAkun,
              tahun: i.tahun,
              bulan: i.bulan,
              nominal: i.nominal,
            })),
          });
        }
      }
    });
    return successResponse({ id }, "Anggaran berhasil diperbarui");
  } catch (e) {
    if (e instanceof z.ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal perbarui anggaran", 500);
  }
}

// DELETE /api/keuangan/anggaran-laba-rugi/[id] - hapus anggaran
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    const header = await prisma.anggaranLabaRugi.findUnique({ where: { id }, select: { id: true } });
    if (!header) return notFoundResponse("Anggaran tidak ditemukan");
    await prisma.anggaranLabaRugi.delete({ where: { id } });
    return successResponse({ id }, "Anggaran berhasil dihapus");
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal hapus anggaran", 500);
  }
}
