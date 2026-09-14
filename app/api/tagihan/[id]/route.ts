import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { kodeAkunByNama } from "@/lib/coa";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

const bayarTagihanSchema = z.object({
  jumlahBayar: z
    .number({ message: "Nominal harus angka" })
    .positive("Nominal harus positif")
    .min(1000, "Nominal minimal Rp 1.000")
    .max(10_000_000_000, "Nominal terlalu besar"),
  sumberDana: z.enum(["KAS", "BANK", "TABUNGAN"]).default("KAS"),
  tanggal: z.coerce.date({ message: "Tanggal tidak valid" }).optional(),
  keterangan: z.string().trim().max(1000, "Keterangan maksimal 1000 karakter").optional().nullable(),
});

// GET /api/tagihan/[id] - detail + riwayat pembayaran
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  try {
    const tagihan = await prisma.tagihan.findUnique({
      where: { id },
      include: {
        admin: { select: { id: true, nama: true } },
        pembayaran: {
          orderBy: { createdAt: "desc" },
          include: { admin: { select: { id: true, nama: true } } },
        },
      },
    });
    if (!tagihan) return errorResponse("Tagihan tidak ditemukan", 404);

    return successResponse({
      id: tagihan.id,
      tipe: tagihan.tipe,
      pihak: tagihan.pihak,
      keterangan: tagihan.keterangan,
      jumlah: Number(tagihan.jumlah),
      sisa: Number(tagihan.sisa),
      tanggal: tagihan.tanggal.toISOString(),
      jatuhTempo: tagihan.jatuhTempo?.toISOString() ?? null,
      status: tagihan.status,
      adminNama: tagihan.admin.nama,
      pembayaran: tagihan.pembayaran.map((p) => ({
        id: p.id,
        tipe: p.tipe,
        kategori: p.kategori,
        sumberDana: p.sumberDana,
        jumlah: Number(p.jumlah),
        keterangan: p.keterangan,
        tanggal: p.tanggal.toISOString(),
        adminNama: p.admin.nama,
      })),
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil tagihan", 500);
  }
}

// PUT /api/tagihan/[id] - catat pembayaran (parsial/lunas) + otomatis jadi transaksi kas
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  let adminId: string | null = (session as { userId?: string } | null)?.userId || null;
  if (!adminId) {
    const fallback = await prisma.user.findFirst({ select: { id: true } });
    adminId = fallback?.id || null;
  }
  if (!adminId) return errorResponse("Admin tidak ditemukan", 500);

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = bayarTagihanSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const tagihan = await tx.tagihan.findUnique({ where: { id } });
      if (!tagihan) throw new Error("Tagihan tidak ditemukan");
      if (tagihan.status === "LUNAS") throw new Error("Tagihan sudah lunas");

      const sisa = Number(tagihan.sisa);
      if (parsed.jumlahBayar - sisa > 0.005) {
        throw new Error(`Nominal melebihi sisa Rp ${Math.round(sisa).toLocaleString("id-ID")}`);
      }

      const isHutang = tagihan.tipe === "HUTANG";
      const kategori = isHutang ? "Pelunasan Hutang Usaha" : "Penerimaan Piutang Usaha";

      await tx.transaksiKas.create({
        data: {
          tipe: isHutang ? "PENGELUARAN" : "PEMASUKAN",
          kategori,
          kodeAkun: kodeAkunByNama(isHutang ? "PENGELUARAN" : "PEMASUKAN", kategori),
          sumberDana: parsed.sumberDana,
          jumlah: parsed.jumlahBayar,
          keterangan:
            parsed.keterangan ??
            `${isHutang ? "Bayar" : "Terima"} ${tagihan.pihak}${tagihan.keterangan ? ` — ${tagihan.keterangan}` : ""}`,
          tanggal: parsed.tanggal ?? new Date(),
          adminId: adminId!,
          tagihanId: tagihan.id,
        },
      });

      const sisaBaru = Math.round((sisa - parsed.jumlahBayar) * 100) / 100;
      const lunas = sisaBaru <= 0.005;

      const updated = await tx.tagihan.update({
        where: { id },
        data: {
          sisa: lunas ? 0 : sisaBaru,
          status: lunas ? "LUNAS" : "LUNAS_SEBAGIAN",
        },
        include: { admin: { select: { id: true, nama: true } } },
      });

      return updated;
    });

    return successResponse(result, result.status === "LUNAS" ? "Tagihan lunas" : "Pembayaran tercatat");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal catat pembayaran", 400);
  }
}

// DELETE /api/tagihan/[id] - hapus tagihan yang belum ada pembayarannya (SUPER_ADMIN, ADMIN_KEUANGAN)
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  try {
    const tagihan = await prisma.tagihan.findUnique({ where: { id } });
    if (!tagihan) return errorResponse("Tagihan tidak ditemukan", 404);

    const pembayaranCount = await prisma.transaksiKas.count({ where: { tagihanId: id } });
    if (pembayaranCount > 0) {
      return errorResponse("Tagihan yang sudah ada pembayarannya tidak bisa dihapus", 400);
    }

    await prisma.tagihan.delete({ where: { id } });
    return successResponse(null, "Tagihan dihapus");
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal hapus tagihan", 500);
  }
}
