import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  JUAL_PER_PELANGGAN_PERIODE,
  getJualPerPelangganSnapshot,
  resolveJualPerPelangganRange,
  type JualPerPelangganPeriode,
} from "@/lib/jual-per-pelanggan-server";
import {
  buildJualPerPelangganPdf,
  buildXlsx,
  jualPerPelangganNamaFile,
  snapshotKeSheetJP,
} from "@/lib/jual-per-pelanggan-export";

// GET /api/keuangan/laporan/penjualan-per-pelanggan?periode=hari-ini&dari=&sampai=&format=json|pdf|xlsx
// Satu sumber data untuk halaman web, PDF, dan XLSX (jaminan angka konsisten).
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "hari-ini";
    if (!(JUAL_PER_PELANGGAN_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as JualPerPelangganPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const dari = searchParams.get("dari") || undefined;
    const sampai = searchParams.get("sampai") || undefined;

    const { start, end, label } = resolveJualPerPelangganRange(periode, dari, sampai);
    const snapshot = await getJualPerPelangganSnapshot(start, end, label);

    if (format === "json") return successResponse(snapshot);

    if (format === "pdf") {
      const buf = buildJualPerPelangganPdf([snapshot]);
      const name = jualPerPelangganNamaFile("pdf", snapshot.end);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheetJP(snapshot, "Penjualan per Pelanggan")]);
    const name = jualPerPelangganNamaFile("xlsx", snapshot.end);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun Penjualan per Pelanggan", 400);
  }
}
