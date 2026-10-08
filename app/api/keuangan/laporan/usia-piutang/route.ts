import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  USIA_PIUTANG_PERIODE,
  getUsiaPiutangSnapshot,
  resolveUsiaTanggal,
  type UsiaPiutangPeriode,
} from "@/lib/usia-piutang-server";
import {
  buildUsiaPdf,
  buildXlsx,
  usiaNamaFile,
  snapshotKeSheetUP,
} from "@/lib/usia-piutang-export";

// GET /api/keuangan/laporan/usia-piutang?periode=hari-ini&tanggal=&format=json|pdf|xlsx
// Laporan posisi per tanggal: satu sumber data untuk web, PDF, dan XLSX.
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "hari-ini";
    if (!(USIA_PIUTANG_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as UsiaPiutangPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const tanggal = searchParams.get("tanggal") || undefined;

    const { asOf, label } = resolveUsiaTanggal(periode, tanggal);
    const snapshot = await getUsiaPiutangSnapshot(asOf, label);

    if (format === "json") return successResponse(snapshot);

    if (format === "pdf") {
      const buf = buildUsiaPdf([snapshot]);
      const name = usiaNamaFile("pdf", snapshot.tanggal);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheetUP(snapshot, "Usia Piutang")]);
    const name = usiaNamaFile("xlsx", snapshot.tanggal);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun Usia Piutang", 400);
  }
}
