import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest, requireAuthAndRole } from "@/lib/auth";
import { createFakturSchema } from "@/lib/validations/pembelianValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

function hitungJumlah(kuantitas: number, harga: number, diskonPersen: number): number {
  return Math.round(kuantitas * harga * (1 - diskonPersen / 100) * 100) / 100;
}

function randomSuffix(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function generateNoFaktur(tanggal: Date): Promise<string> {
  const ymd = `${tanggal.getFullYear()}${String(tanggal.getMonth() + 1).padStart(2, "0")}${String(
    tanggal.getDate()
  ).padStart(2, "0")}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `FB-${ymd}-${randomSuffix()}`;
    const exists = await prisma.fakturPembelian.findUnique({
      where: { noFaktur: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `FB-${ymd}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

// GET /api/pembelian/faktur?q=&status= - daftar faktur + status bayar nyata
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";

  const rows = await prisma.fakturPembelian.findMany({
    where: q
      ? {
          OR: [
            { noFaktur: { contains: q, mode: "insensitive" } },
            { supplier: { nama: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {},
    orderBy: { tanggal: "desc" },
    take: 100,
    include: {
      supplier: { select: { id: true, nama: true } },
      tagihan: { select: { id: true, status: true, sisa: true, jumlah: true } },
      _count: { select: { items: true } },
    },
  });

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return successResponse(
    rows.map((f) => {
      const st = f.tagihan?.status ?? "BELUM_LUNAS";
      const telat =
        st !== "LUNAS" && f.jatuhTempo ? new Date(f.jatuhTempo) < now : false;
      return {
        id: f.id,
        noFaktur: f.noFaktur,
        supplier: f.supplier.nama,
        tanggal: f.tanggal.toISOString(),
        jatuhTempo: f.jatuhTempo?.toISOString() ?? null,
        status: st,
        telat,
        sisa: f.tagihan ? Number(f.tagihan.sisa) : Number(f.total),
        total: Number(f.total),
        jumlahItem: f._count.items,
        tagihanId: f.tagihan?.id ?? null,
      };
    })
  );
}

// POST /api/pembelian/faktur - simpan faktur pembelian.
// Akuntansi: DEBIT per baris via kodeAkun (persediaan/beban, dari COA database),
// KREDIT 2101 Utang Usaha via Tagihan HUTANG. Tanpa Kas & Bank, tanpa stok ganda.
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
    const parsed = createFakturSchema.parse(body);
    const tanggal = parsed.tanggal ?? new Date();

    const result = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: parsed.supplierId } });
      if (!supplier) throw new Error("Supplier tidak ditemukan");

      // Akun DEBIT tiap baris ditentukan otomatis terhadap COA database:
      // - produk master persediaan → akun persediaannya (1105/1106/1107),
      // - selain itu → 5402 (Beban Lain-lain/Belum Teridentifikasi).
      // kodeAkun eksplisit hanya didukung untuk kompatibilitas lama.
      const items = [];
      for (const it of parsed.items) {
        let kodeAkun = it.kodeAkun?.trim() || null;
        if (kodeAkun) {
          const akun = await tx.akunCOA.findUnique({ where: { kode: kodeAkun } });
          if (!akun || !akun.isActive) {
            throw new Error(`Akun COA ${kodeAkun} tidak ditemukan atau nonaktif`);
          }
          const isPersediaan = ["1105", "1106", "1107"].includes(akun.kode);
          if (akun.kelompok !== "Beban" && !isPersediaan) {
            throw new Error(`Baris "${it.deskripsi}": akun harus persediaan (1105/1106/1107) atau Beban (dipilih ${kodeAkun} - ${akun.nama})`);
          }
        } else if (it.produkId) {
          const barang = await tx.persediaanBarang.findUnique({
            where: { id: it.produkId },
            select: { id: true, kodeAkunCOA: true, kategori: true },
          });
          if (!barang) throw new Error(`Produk "${it.deskripsi}" tidak ditemukan di persediaan`);
          kodeAkun = barang.kodeAkunCOA ?? null;
          if (!kodeAkun) {
            const fallback: Record<string, string> = {
              "Pupuk & Obat-obatan": "1105",
              "Pakan Ternak/Ikan": "1106",
              "Bibit/Benih": "1107",
            };
            kodeAkun = fallback[barang.kategori] ?? "5402";
          }
          const akun = await tx.akunCOA.findUnique({ where: { kode: kodeAkun } });
          if (!akun || !akun.isActive) {
            throw new Error(`Akun COA ${kodeAkun} tidak ditemukan atau nonaktif`);
          }
        } else {
          kodeAkun = "5402";
          const akun = await tx.akunCOA.findUnique({ where: { kode: kodeAkun } });
          if (!akun || !akun.isActive) {
            throw new Error(`Akun COA ${kodeAkun} tidak ditemukan atau nonaktif`);
          }
        }
        items.push({
          produkId: it.produkId?.trim() || null,
          deskripsi: it.deskripsi.trim(),
          kuantitas: it.kuantitas,
          unit: it.unit.trim(),
          harga: it.harga,
          diskonPersen: it.diskonPersen ?? 0,
          kodeAkun,
          jumlah: hitungJumlah(it.kuantitas, it.harga, it.diskonPersen ?? 0),
        });
      }
      const subtotal = Math.round(items.reduce((s, it) => s + it.jumlah, 0) * 100) / 100;
      const noFaktur = await generateNoFaktur(tanggal);

      // Satu faktur = satu utang (KREDIT 2101). Tanpa transaksi Kas & Bank.
      const tagihan = await tx.tagihan.create({
        data: {
          tipe: "HUTANG",
          pihak: supplier.nama,
          keterangan: parsed.memo?.trim() || parsed.pesan?.trim() || `Faktur ${noFaktur}`,
          jumlah: subtotal,
          sisa: subtotal,
          tanggal,
          jatuhTempo: parsed.jatuhTempo ?? null,
          dokumen: "FAKTUR_PEMBELIAN",
          noInvoice: noFaktur,
          adminId: adminId!,
        },
        select: { id: true },
      });

      const faktur = await tx.fakturPembelian.create({
        data: {
          noFaktur,
          supplierId: supplier.id,
          email: parsed.email?.trim() || null,
          alamat: parsed.alamat?.trim() || null,
          tanggal,
          jatuhTempo: parsed.jatuhTempo ?? null,
          noRefSupplier: parsed.noRefSupplier?.trim() || null,
          syaratPembayaran: parsed.syaratPembayaran?.trim() || null,
          gudang: parsed.gudang?.trim() || null,
          tag: parsed.tag?.trim() || null,
          pesan: parsed.pesan?.trim() || null,
          memo: parsed.memo?.trim() || null,
          subtotal,
          total: subtotal,
          tagihanId: tagihan.id,
          adminId: adminId!,
          items: {
            create: items.map((it) => ({
              produkId: it.produkId,
              deskripsi: it.deskripsi,
              kuantitas: it.kuantitas,
              unit: it.unit,
              harga: it.harga,
              diskonPersen: it.diskonPersen,
              kodeAkun: it.kodeAkun,
              jumlah: it.jumlah,
            })),
          },
          ...(parsed.lampiran && parsed.lampiran.length > 0
            ? {
                lampiran: {
                  create: parsed.lampiran.map((l) => ({
                    fileName: l.fileName,
                    fileUrl: l.fileUrl,
                    fileType: l.fileType ?? "application/octet-stream",
                    fileSize: l.fileSize ?? 0,
                  })),
                },
              }
            : {}),
        },
        include: {
          supplier: { select: { id: true, nama: true } },
          _count: { select: { items: true, lampiran: true } },
        },
      });

      return faktur;
    });

    return successResponse(result, "Faktur pembelian berhasil disimpan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal simpan faktur", 500);
  }
}
