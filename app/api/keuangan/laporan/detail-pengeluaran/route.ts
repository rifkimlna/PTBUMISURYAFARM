import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  DETAIL_PENGELUARAN_PERIODE,
  getDetailPengeluaranSnapshot,
  resolveDetailPengeluaranRange,
  type DetailPengeluaranPeriode,
} from "@/lib/detail-pengeluaran-server";
import {
  buildDetailPengeluaranPdf,
  buildXlsx,
  detailPengeluaranNamaFile,
  snapshotKeSheet,
} from "@/lib/detail-pengeluaran-export";

// GET /api/keuangan/laporan/detail-pengeluaran?periode=bulan-ini[&dari=&sampai=][&format=json|pdf|xlsx]
// Satu sumber data untuk halaman web, PDF, dan XLSX (jaminan angka konsisten).
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "bulan-ini";
    if (!(DETAIL_PENGELUARAN_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as DetailPengeluaranPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const dari = searchParams.get("dari") || undefined;
    const sampai = searchParams.get("sampai") || undefined;

    const { start, end, label } = resolveDetailPengeluaranRange(periode, dari, sampai);
    const snapshot = await getDetailPengeluaranSnapshot(start, end, periode, label);

    if (format === "json") {
      return successResponse({ mode: "single", snapshot });
    }

    if (format === "pdf") {
      const buf = buildDetailPengeluaranPdf([snapshot]);
      const name = detailPengeluaranNamaFile("pdf", snapshot.end);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheet(snapshot, "Detail Pengeluaran")]);
    const name = detailPengeluaranNamaFile("xlsx", snapshot.end);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun Detail Pengeluaran", 400);
  }
}
