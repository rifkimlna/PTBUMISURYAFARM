import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { createTransaksiKasSchema, queryKeuanganSchema, updateTransaksiKasSchema } from "@/lib/validations/keuanganValidation";
import { kodeAkunByNama, SUMBER_DANA_KODE_MAP } from "@/lib/coa";
import { getSaldoPerSumber, generateNoTransaksi } from "@/lib/keuangan-server";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

// GET /api/keuangan - SUPER_ADMIN, ADMIN_KEUANGAN only
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const query = queryKeuanganSchema.parse({
      tipe: searchParams.get("tipe") || undefined,
      kategori: searchParams.get("kategori") || undefined,
      sumberDana: searchParams.get("sumberDana") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.tipe) where.tipe = query.tipe;
    if (query.kategori) where.kategori = { contains: query.kategori, mode: "insensitive" };
    if (query.sumberDana) where.sumberDana = query.sumberDana;
    if (query.startDate || query.endDate) {
      where.tanggal = {};
      // Periode mencakup seluruh hari yang dipilih (dari 00:00 sampai 23:59:59)
      if (query.startDate) {
        const start = new Date(query.startDate);
        start.setHours(0, 0, 0, 0);
        where.tanggal.gte = start;
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.tanggal.lte = end;
      }
    }

    const [data, total, summary, perSumber] = await Promise.all([
      prisma.transaksiKas.findMany({
        where,
        skip,
        take: limit,
        orderBy: { tanggal: "desc" },
        include: { admin: { select: { id: true, nama: true, email: true } }, _count: { select: { bukti: true } } },
      }),
      prisma.transaksiKas.count({ where }),
      prisma.transaksiKas.groupBy({ by: ["tipe"], where, _sum: { jumlah: true } }),
      // Posisi dana per sumber: hanya ikut filter tanggal (abaikan filter tipe/kategori/sumber
      // tabel) agar ketiga sumber selalu tampil utuh dalam periode yang sama.
      // Transfer dihitung dari sumberDana (keluar) DAN sumberDanaTujuan (masuk).
      getSaldoPerSumber(where.tanggal ? { gte: where.tanggal.gte, lte: where.tanggal.lte } : undefined),
    ]);

    // Filter out TRANSFER from pemasukan/pengeluaran totals
    const filteredSummary = summary.filter((s) => s.tipe !== "TRANSFER");
    const totalMasuk = filteredSummary.find((s) => s.tipe === "PEMASUKAN")?._sum.jumlah ?? 0;
    const totalKeluar = filteredSummary.find((s) => s.tipe === "PENGELUARAN")?._sum.jumlah ?? 0;

    return successResponse({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        pemasukan: totalMasuk,
        pengeluaran: totalKeluar,
        saldo: Number(totalMasuk) - Number(totalKeluar),
        perSumber: {
          KAS: perSumber.KAS,
          BANK: perSumber.BANK,
          TABUNGAN: perSumber.TABUNGAN,
        },
      },
    });
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil keuangan", 500);
  }
}

// POST /api/keuangan - tanpa login demo
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  let adminId: string | null = (session as any)?.userId || null;
  if (!adminId) {
    const fallback = await prisma.user.findFirst({ select: { id: true } });
    adminId = fallback?.id || null;
  }
  if (!adminId) return errorResponse("Admin tidak ditemukan", 500);

  try {
    const body = await req.json();
    const parsed = createTransaksiKasSchema.parse(body);

    const tanggalTransaksi = parsed.tanggal ?? new Date();
    // No transaksi: pakai kiriman form, atau auto-generate yang unik
    const noTransaksi =
      parsed.noTransaksi?.trim() ||
      (await generateNoTransaksi(parsed.tipe as "PEMASUKAN" | "PENGELUARAN" | "TRANSFER", tanggalTransaksi));

    const transaksi = await prisma.$transaction(async (tx) => {
      // Logika berdasarkan tipe transaksi
      let resolvedKodeAkun: string | null = null;
      let resolvedSumberDanaTujuan: "KAS" | "BANK" | "TABUNGAN" | null = null;

      if (parsed.tipe === "TRANSFER") {
        // Untuk TRANSFER: sumberDanaTujuan wajib diisi dan beda dari sumberDana
        // kodeAkun = null (transfer bukan pemasukan/pengeluaran COA).
        // Transfer dicatat sebagai SATU baris: saldo asal berkurang, tujuan bertambah.
        resolvedKodeAkun = null;
        resolvedSumberDanaTujuan = parsed.sumberDanaTujuan ?? null;
      } else {
        // Untuk PEMASUKAN/PENGELUARAN: tentukan kode akun dari kategori
        resolvedKodeAkun = kodeAkunByNama(parsed.tipe as any, parsed.kategori);
      }

      const created = await tx.transaksiKas.create({
        data: {
          tipe: parsed.tipe as any,
          kategori: parsed.kategori,
          kodeAkun: resolvedKodeAkun,
          sumberDana: parsed.sumberDana ?? "KAS",
          // Tambahkan sumberDanaTujuan untuk TRANSFER
          ...(parsed.tipe === "TRANSFER" && resolvedSumberDanaTujuan
            ? { sumberDanaTujuan: resolvedSumberDanaTujuan }
            : {}),
          jumlah: parsed.jumlah as any,
          keterangan: parsed.keterangan ?? null,
          tanggal: tanggalTransaksi,
          noTransaksi,
          pihak: parsed.pihak?.trim() || null,
          tag: parsed.tag?.trim() || null,
          deskripsi: parsed.deskripsi?.trim() || null,
          adminId: adminId!,
        },
        include: { admin: { select: { id: true, nama: true } }, _count: { select: { bukti: true } } },
      });

      if (parsed.bukti && parsed.bukti.length > 0) {
        await tx.buktiTransaksi.createMany({
          data: parsed.bukti.map((b) => ({
            transaksiId: created.id,
            fileName: b.fileName,
            fileUrl: b.fileUrl,
            fileType: b.fileType ?? "application/octet-stream",
            fileSize: b.fileSize ?? 0,
          })),
        });
      }

      return created;
    });

    return successResponse(transaksi, "Transaksi berhasil ditambahkan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal tambah transaksi", 500);
  }
}
