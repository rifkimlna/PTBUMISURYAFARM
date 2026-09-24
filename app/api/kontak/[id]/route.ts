import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { updateKontakSchema } from "@/lib/validations/kontakValidation";
import { ensurePelangganForKontak, ensureSupplierForKontak, generateKodeKaryawan } from "@/lib/kontak-sync";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

// GET /api/kontak/[id] - detail kontak master
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  try {
    const kontak = await prisma.kontak.findUnique({ where: { id } });
    if (!kontak) return errorResponse("Kontak tidak ditemukan", 404);
    return successResponse(kontak);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil kontak", 500);
  }
}

// PUT /api/kontak/[id] - ubah kontak master (tanpa login demo)
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  void session;

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = updateKontakSchema.parse(body);

    const exists = await prisma.kontak.findUnique({ where: { id } });
    if (!exists) return errorResponse("Kontak tidak ditemukan", 404);

    const tipeAkhir = parsed.tipe ?? exists.tipe;

    // Field karyawan hanya berlaku untuk tipe KARYAWAN. Pindah tipe menjauhi
    // Karyawan mengosongkan field khusus; pindah ke Karyawan tanpa ID
    // kuatkan dengan ID otomatis.
    let patchKaryawan: Prisma.KontakUpdateInput = {};
    if (tipeAkhir === "KARYAWAN") {
      let kode = parsed.kodeKaryawan?.toUpperCase() ?? exists.kodeKaryawan;
      if (!kode) kode = await generateKodeKaryawan(prisma);
      const [tabrakanKontak, tabrakanArsip] = await Promise.all([
        prisma.kontak.findFirst({ where: { kodeKaryawan: kode, id: { not: id } }, select: { id: true } }),
        prisma.karyawan.findUnique({ where: { id: kode }, select: { id: true } }),
      ]);
      // Arsip lama dengan ID sama namun beda orang tetap ditolak agar
      // rujukan riwayat gaji tidak tertukar; bila itu hasil migrasi baris
      // ini sendiri (nama sama), izinkan.
      if (tabrakanKontak) return errorResponse(`ID karyawan ${kode} sudah dipakai`, 409);
      if (tabrakanArsip) {
        const arsip = await prisma.karyawan.findUnique({
          where: { id: kode },
          select: { namaLengkap: true },
        });
        const namaBaru = (parsed.nama ?? exists.nama).trim().toLowerCase();
        if (!arsip || arsip.namaLengkap.trim().toLowerCase() !== namaBaru) {
          return errorResponse(`ID karyawan ${kode} sudah dipakai`, 409);
        }
      }
      patchKaryawan = {
        kodeKaryawan: kode,
        ...(parsed.jabatan !== undefined ? { jabatan: parsed.jabatan } : {}),
        ...(parsed.statusKerja !== undefined ? { statusKerja: parsed.statusKerja } : {}),
        ...(parsed.lokasiKerja !== undefined ? { lokasiKerja: parsed.lokasiKerja } : {}),
        ...(parsed.tanggalMasuk !== undefined ? { tanggalMasuk: parsed.tanggalMasuk } : {}),
        ...(parsed.gajiPokok !== undefined ? { gajiPokok: parsed.gajiPokok } : {}),
        ...(parsed.tanggalLahir !== undefined ? { tanggalLahir: parsed.tanggalLahir } : {}),
        ...(parsed.jenisKelamin !== undefined ? { jenisKelamin: parsed.jenisKelamin } : {}),
      };
    } else if (exists.tipe === "KARYAWAN" && parsed.tipe !== undefined && parsed.tipe !== "KARYAWAN") {
      patchKaryawan = {
        kodeKaryawan: null,
        jabatan: null,
        statusKerja: null,
        lokasiKerja: null,
        tanggalMasuk: null,
        gajiPokok: null,
        tanggalLahir: null,
        jenisKelamin: null,
      };
    }

    const updated = await prisma.kontak.update({
      where: { id },
      data: {
        ...(parsed.nama !== undefined ? { nama: parsed.nama } : {}),
        ...(parsed.tipe !== undefined ? { tipe: parsed.tipe } : {}),
        ...(parsed.perusahaan !== undefined ? { perusahaan: parsed.perusahaan } : {}),
        ...(parsed.email !== undefined ? { email: parsed.email?.trim() || null } : {}),
        ...(parsed.noHp !== undefined ? { noHp: parsed.noHp } : {}),
        ...(parsed.noTelepon !== undefined ? { noTelepon: parsed.noTelepon } : {}),
        ...(parsed.alamat !== undefined ? { alamat: parsed.alamat } : {}),
        ...(parsed.catatan !== undefined ? { catatan: parsed.catatan } : {}),
        ...patchKaryawan,
      },
    });

    // Jaga pasangan Penjualan/Pembelian tetap ada setelah edit.
    // Catatan: dokumen lama tetap merujuk nama sebelumnya (snapshot nama di
    // Tagihan.pihak), jadi edit nama tidak mengubah riwayat — hanya
    // memastikan nama baru bisa dipakai di form.
    try {
      if (updated.tipe === "PELANGGAN") {
        await ensurePelangganForKontak(prisma, updated);
      } else if (updated.tipe === "SUPPLIER") {
        await ensureSupplierForKontak(prisma, updated);
      }
    } catch {
      // abaikan
    }

    return successResponse(updated, "Kontak berhasil diubah");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal ubah kontak", 400);
  }
}
