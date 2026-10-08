import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  PENGIRIMAN_PENJUALAN_PERIODE,
  getPengirimanPenjualanSnapshot,
  resolvePengirimanRange,
  type PengirimanPenjualanPeriode,
} from "@/lib/pengiriman-penjualan-server";
import {
  buildPengirimanPdf,
  buildXlsx,
  pengirimanNamaFile,
  snapshotKeSheetPK,
} from "@/lib/pengiriman-penjualan-export";

// GET /api/keuangan/laporan/pengiriman-penjualan?periode=hari-ini&dari=&sampai=&format=json|pdf|xlsx
// Satu sumber data untuk halaman web, PDF, dan XLSX (jaminan angka konsisten).
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "hari-ini";
    if (!(PENGIRIMAN_PENJUALAN_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as PengirimanPenjualanPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const dari = searchParams.get("dari") || undefined;
    const sampai = searchParams.get("sampai") || undefined;

    const { start, end, label } = resolvePengirimanRange(periode, dari, sampai);
    const snapshot = await getPengirimanPenjualanSnapshot(start, end, label);

    if (format === "json") return successResponse(snapshot);

    if (format === "pdf") {
      const buf = buildPengirimanPdf([snapshot]);
      const name = pengirimanNamaFile("pdf", snapshot.end);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheetPK(snapshot, "Pengiriman Penjualan")]);
    const name = pengirimanNamaFile("xlsx", snapshot.end);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun Pengiriman Penjualan", 400);
  }
}
