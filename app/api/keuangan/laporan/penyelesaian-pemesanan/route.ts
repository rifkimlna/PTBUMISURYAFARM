import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  PENYELESAIAN_PERIODE,
  getPenyelesaianSnapshot,
  resolvePenyelesaianRange,
  type PenyelesaianPeriode,
} from "@/lib/penyelesaian-pemesanan-server";
import {
  buildPenyelesaianPdf,
  buildXlsx,
  penyelesaianNamaFile,
  snapshotKeSheetPN,
} from "@/lib/penyelesaian-pemesanan-export";

// GET /api/keuangan/laporan/penyelesaian-pemesanan?periode=hari-ini&dari=&sampai=&page=&limit=&format=json|pdf|xlsx
// Satu sumber data untuk halaman web, PDF, dan XLSX (jaminan angka konsisten).
// PDF/XLSX selalu memuat SELURUH baris terfilter (tanpa paginasi).
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "hari-ini";
    if (!(PENYELESAIAN_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as PenyelesaianPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const dari = searchParams.get("dari") || undefined;
    const sampai = searchParams.get("sampai") || undefined;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 10));

    const { start, end, label } = resolvePenyelesaianRange(periode, dari, sampai);

    if (format === "json") {
      const snapshot = await getPenyelesaianSnapshot(start, end, label, { page, limit, paginate: true });
      return successResponse({
        ...snapshot,
        pagination: {
          page,
          limit,
          total: snapshot.total,
          totalPages: Math.max(1, Math.ceil(snapshot.total / limit)),
        },
      });
    }

    const full = await getPenyelesaianSnapshot(start, end, label, { paginate: false });
    if (format === "pdf") {
      const buf = buildPenyelesaianPdf([full]);
      const name = penyelesaianNamaFile("pdf", full.end);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheetPN(full, "Penyelesaian Pemesanan")]);
    const name = penyelesaianNamaFile("xlsx", full.end);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun Penyelesaian Pemesanan", 400);
  }
}
