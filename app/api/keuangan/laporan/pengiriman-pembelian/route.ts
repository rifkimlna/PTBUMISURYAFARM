import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  PENGIRIMAN_PEMBELIAN_PERIODE,
  getPengirimanPembelianSnapshot,
  resolvePengirimanPembelianRange,
  type PengirimanPembelianPeriode,
} from "@/lib/pengiriman-pembelian-server";
import {
  buildPengirimanPembelianPdf,
  buildXlsx,
  pengirimanPembelianNamaFile,
  snapshotKeSheetPengirimanBeli,
} from "@/lib/pengiriman-pembelian-export";

// GET /api/keuangan/laporan/pengiriman-pembelian?periode=hari-ini&dari=&sampai=&format=json|pdf|xlsx
// Satu sumber data untuk halaman web, PDF, dan XLSX (jaminan angka konsisten).
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "hari-ini";
    if (!(PENGIRIMAN_PEMBELIAN_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as PengirimanPembelianPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const dari = searchParams.get("dari") || undefined;
    const sampai = searchParams.get("sampai") || undefined;

    const { start, end, label } = resolvePengirimanPembelianRange(periode, dari, sampai);
    const snapshot = await getPengirimanPembelianSnapshot(start, end, label);

    if (format === "json") return successResponse(snapshot);

    if (format === "pdf") {
      const buf = buildPengirimanPembelianPdf([snapshot]);
      const name = pengirimanPembelianNamaFile("pdf", snapshot.end);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheetPengirimanBeli(snapshot, "Pengiriman Pembelian")]);
    const name = pengirimanPembelianNamaFile("xlsx", snapshot.end);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun Pengiriman Pembelian", 400);
  }
}
