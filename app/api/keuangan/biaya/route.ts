import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { kodeAkunByNama } from "@/lib/coa";
import { getKodeAkunByNamaFromDB } from "@/lib/coa-server";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { createBiayaSchema, type CreateBiayaInput } from "@/lib/validations/keuanganValidation";

function randomSuffix(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function generateNoBiaya(tanggal: Date): Promise<string> {
  const ymd = `${tanggal.getFullYear()}${String(tanggal.getMonth() + 1).padStart(2, "0")}${String(
    tanggal.getDate()
  ).padStart(2, "0")}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `BY-${ymd}-${randomSuffix()}`;
    const exists = await prisma.biaya.findUnique({
      where: { noBiaya: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `BY-${ymd}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

// POST /api/keuangan/biaya - buat biaya baru (tunai atau hutang)
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  let adminId: string | null = (session as { userId?: string } | null)?.userId || null;
  if (!adminId) {
    const fallback = await prisma.user.findFirst({ select: { id: true } });
    adminId = fallback?.id || null;
  }
  if (!adminId) return errorResponse("Admin tidak ditemukan", 500);

  try {
    const body = await req.json();
    const parsed = createBiayaSchema.parse(body) as CreateBiayaInput;
    const tanggal = parsed.tanggal ?? new Date();

    const result = await prisma.$transaction(async (tx) => {
      let transaksiKasId: string | null = parsed.transaksiKasId ?? null;
      let tagihanId: string | null = null;
      let jumlah: number = parsed.jumlah;

      if (parsed.tipe === "TUNAI") {
        if (transaksiKasId) {
          // Tautkan ke TransaksiKas PENGELUARAN yang sudah ada
          const existing = await tx.transaksiKas.findUnique({
            where: { id: transaksiKasId },
            select: { id: true, tipe: true, jumlah: true, kodeAkun: true, kategori: true, sumberDana: true },
          });
          if (!existing) throw new Error("Transaksi kas tidak ditemukan");
          if (existing.tipe !== "PENGELUARAN") {
            throw new Error("Transaksi kas yang dipilih bukan pengeluaran");
          }
          // Verifikasi belum ada Biaya yang menautkan transaksi kas ini
          const sudahDiBiaya = await tx.biaya.findUnique({
            where: { transaksiKasId: existing.id },
            select: { id: true },
          });
          if (sudahDiBiaya) {
            throw new Error("Transaksi kas sudah tercatat sebagai biaya");
          }
          jumlah = Number(existing.jumlah);
        } else {
          // Buat TransaksiKas PENGELUARAN baru
          let kodeAkun = parsed.kodeAkun?.trim() || null;
          if (!kodeAkun) {
            kodeAkun =
              (await getKodeAkunByNamaFromDB(parsed.kategori, "PENGELUARAN")) ??
              kodeAkunByNama("PENGELUARAN", parsed.kategori) ??
              "5402";
          }
          const tk = await tx.transaksiKas.create({
            data: {
              tipe: "PENGELUARAN",
              kategori: parsed.kategori,
              kodeAkun,
              sumberDana: parsed.sumberDana!,
              jumlah: parsed.jumlah,
              keterangan: parsed.memo?.trim() || undefined,
              tanggal,
              adminId: adminId!,
            },
            select: { id: true, sumberDana: true, jumlah: true },
          });
          transaksiKasId = tk.id;
          jumlah = Number(tk.jumlah);
        }
      } else if (parsed.tipe === "HUTANG") {
        // Buat Tagihan HUTANG baru
        const tagihan = await tx.tagihan.create({
          data: {
            tipe: "HUTANG",
            pihak: parsed.penerima,
            keterangan: parsed.memo?.trim() || `Biaya ${parsed.kategori}`,
            jumlah: parsed.jumlah,
            sisa: parsed.jumlah,
            tanggal,
            jatuhTempo: parsed.jatuhTempo ?? null,
            dokumen: "BIAYA",
            noInvoice: null,
            adminId: adminId!,
          },
          select: { id: true },
        });
        tagihanId = tagihan.id;
      }

      const noBiaya = await generateNoBiaya(tanggal);

      const biaya = await tx.biaya.create({
        data: {
          noBiaya,
          tanggal,
          jatuhTempo: parsed.tipe === "HUTANG" ? parsed.jatuhTempo ?? null : null,
          kategori: parsed.kategori,
          kodeAkun: parsed.kodeAkun?.trim() || null,
          penerima: parsed.penerima,
          jumlah,
          sisa: parsed.tipe === "HUTANG" ? parsed.jumlah : 0,
          status:
            parsed.tipe === "HUTANG" ? "BELUM_LUNAS" : "LUNAS",
          tags: parsed.tags?.trim() || null,
          memo: parsed.memo?.trim() || null,
          tagihanId,
          transaksiKasId,
          adminId: adminId!,
        },
        include: {
          admin: { select: { nama: true } },
        },
      });

      return biaya;
    });

    return successResponse(result, "Biaya berhasil dibuat", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal membuat biaya", 500);
  }
}
