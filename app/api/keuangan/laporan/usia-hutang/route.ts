import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  USIA_HUTANG_PERIODE,
  USIA_HUTANG_KATEGORI,
  getUsiaHutangSnapshot,
  resolveUsiaHutangTanggal,
  type KategoriAgingHutang,
  type UsiaHutangPeriode,
} from "@/lib/usia-hutang-server";
import {
  buildUsiaHutangPdf,
  buildUsiaHutangXlsx,
  usiaHutangNamaFile,
  snapshotKeSheetUH,
  snapshotKeSheetUHDetail,
} from "@/lib/usia-hutang-export";

// GET /api/keuangan/laporan/usia-hutang?periode=hari-ini&tanggal=&supplier=&kategori=&format=json|pdf|xlsx
// Laporan posisi per tanggal acuan: satu sumber data untuk web, PDF, dan XLSX.
// Hanya faktur pembelian yang belum lunas (sisa > 0) yang dihitung.
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "hari-ini";
    if (!(USIA_HUTANG_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as UsiaHutangPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const tanggal = searchParams.get("tanggal") || undefined;
    const supplier = searchParams.get("supplier") || undefined;
    const kategoriRaw = searchParams.get("kategori") || undefined;
    if (kategoriRaw && !(USIA_HUTANG_KATEGORI as string[]).includes(kategoriRaw)) {
      return errorResponse("Kategori aging tidak valid", 400);
    }
    const kategori = kategoriRaw as KategoriAgingHutang | undefined;

    const { asOf, label } = resolveUsiaHutangTanggal(periode, tanggal);
    const snapshot = await getUsiaHutangSnapshot(asOf, label, { supplier, kategori });

    if (format === "json") return successResponse(snapshot);

    if (format === "pdf") {
      const buf = buildUsiaHutangPdf([snapshot]);
      const name = usiaHutangNamaFile("pdf", snapshot.tanggal);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildUsiaHutangXlsx([
      snapshotKeSheetUH(snapshot, "Usia Hutang"),
      snapshotKeSheetUHDetail(snapshot, "Rincian Faktur"),
    ]);
    const name = usiaHutangNamaFile("xlsx", snapshot.tanggal);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun Usia Hutang Pembelian", 400);
  }
}
