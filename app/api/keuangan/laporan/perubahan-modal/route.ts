import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  PERUBAHAN_MODAL_PERIODE,
  getPerubahanModalSnapshot,
  resolvePerubahanModalRange,
  type PerubahanModalPeriode,
} from "@/lib/perubahan-modal-server";
import {
  buildPerubahanModalPdf,
  buildXlsx,
  perubahanModalNamaFile,
  snapshotKeSheet,
} from "@/lib/perubahan-modal-export";

// GET /api/keuangan/laporan/perubahan-modal?periode=bulan-ini[&tanggal=YYYY-MM-DD][&dari=&sampai=][&format=json|pdf|xlsx]
// Satu sumber data untuk halaman web, PDF, dan XLSX (jaminan angka konsisten).
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "bulan-ini";
    if (!(PERUBAHAN_MODAL_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as PerubahanModalPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const tanggal = searchParams.get("tanggal") || undefined;
    const dari = searchParams.get("dari") || undefined;
    const sampai = searchParams.get("sampai") || undefined;

    const { start, end, label } = resolvePerubahanModalRange(periode, tanggal, dari, sampai);
    const snapshot = await getPerubahanModalSnapshot(start, end, periode, label);

    if (format === "json") {
      return successResponse({ mode: "single", snapshot });
    }

    if (format === "pdf") {
      const buf = buildPerubahanModalPdf([snapshot]);
      const name = perubahanModalNamaFile("pdf", snapshot.end);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheet(snapshot, "Perubahan Modal")]);
    const name = perubahanModalNamaFile("xlsx", snapshot.end);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun Perubahan Modal", 400);
  }
}
