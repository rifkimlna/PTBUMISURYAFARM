import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { z } from "zod";

// Anggaran Laba Rugi: periode maksimal 6 bulan, akun mengacu ke kode AkunCOA
// kelompok Pendapatan/Beban (tanpa master akun terpisah).

const itemSchema = z.object({
  kodeAkun: z.string().min(1, "Kode akun wajib diisi").max(10),
  tahun: z.number().int().min(2000).max(2100),
  bulan: z.number().int().min(1).max(12),
  nominal: z.number().finite().min(0, "Nominal minimal 0").max(1e15),
});

const createSchema = z.object({
  nama: z.string().min(2, "Nama anggaran minimal 2 karakter").max(100),
  tahunMulai: z.number().int().min(2000).max(2100),
  bulanMulai: z.number().int().min(1).max(12),
  durasi: z.number().int().min(1, "Durasi minimal 1 bulan").max(6, "Periode anggaran maksimal 6 bulan"),
  items: z.array(itemSchema).max(5000).default([]),
});

export function bulanPeriode(tahunMulai: number, bulanMulai: number, durasi: number) {
  const out: { tahun: number; bulan: number }[] = [];
  for (let i = 0; i < durasi; i++) {
    const idx = bulanMulai - 1 + i;
    out.push({ tahun: tahunMulai + Math.floor(idx / 12), bulan: (idx % 12) + 1 });
  }
  return out;
}

const KODE_NON_LABA_RUGI = new Set(["4105"]); // Penerimaan Piutang: mutasi neraca, bukan pendapatan

async function validasiItems(
  items: z.infer<typeof itemSchema>[],
  tahunMulai: number,
  bulanMulai: number,
  durasi: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const periode = new Set(bulanPeriode(tahunMulai, bulanMulai, durasi).map((b) => `${b.tahun}-${b.bulan}`));
  for (const it of items) {
    if (!periode.has(`${it.tahun}-${it.bulan}`)) {
      return { ok: false, message: `Item ${it.kodeAkun} di luar periode anggaran` };
    }
    if (KODE_NON_LABA_RUGI.has(it.kodeAkun)) {
      return { ok: false, message: `Akun ${it.kodeAkun} bukan akun laba rugi` };
    }
  }
  const kodes = [...new Set(items.map((i) => i.kodeAkun))];
  if (kodes.length > 0) {
    const akun = await prisma.akunCOA.findMany({
      where: { kode: { in: kodes } },
      select: { kode: true, kelompok: true, isActive: true },
    });
    const map = new Map(akun.map((a) => [a.kode, a]));
    for (const k of kodes) {
      const a = map.get(k);
      if (!a) return { ok: false, message: `Akun ${k} tidak terdaftar di Daftar Akun` };
      if (a.kelompok !== "Pendapatan" && a.kelompok !== "Beban") {
        return { ok: false, message: `Akun ${k} bukan akun Pendapatan/Beban` };
      }
      if (!a.isActive) return { ok: false, message: `Akun ${k} sudah nonaktif` };
    }
  }
  return { ok: true };
}

// GET /api/keuangan/anggaran-laba-rugi - daftar anggaran tersimpan
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const data = await prisma.anggaranLabaRugi.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        nama: true,
        tahunMulai: true,
        bulanMulai: true,
        durasi: true,
        updatedAt: true,
        createdBy: { select: { nama: true } },
        _count: { select: { items: true } },
      },
    });
    return successResponse(data);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil daftar anggaran", 500);
  }
}

// POST /api/keuangan/anggaran-laba-rugi - simpan anggaran baru
export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const session = await getSessionFromRequest(req);

  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);
    const cek = await validasiItems(parsed.items, parsed.tahunMulai, parsed.bulanMulai, parsed.durasi);
    if (!cek.ok) return errorResponse(cek.message, 400);

    const nonzero = parsed.items.filter((i) => i.nominal > 0);
    const created = await prisma.anggaranLabaRugi.create({
      data: {
        nama: parsed.nama.trim(),
        tahunMulai: parsed.tahunMulai,
        bulanMulai: parsed.bulanMulai,
        durasi: parsed.durasi,
        createdById: session?.userId ?? null,
        items: {
          create: nonzero.map((i) => ({
            kodeAkun: i.kodeAkun,
            tahun: i.tahun,
            bulan: i.bulan,
            nominal: i.nominal,
          })),
        },
      },
      select: { id: true },
    });
    return successResponse(created, "Anggaran berhasil disimpan", 201);
  } catch (e) {
    if (e instanceof z.ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal simpan anggaran", 500);
  }
}
