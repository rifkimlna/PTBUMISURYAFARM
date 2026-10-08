import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  PIUTANG_PELANGGAN_PERIODE,
  getPiutangPelangganSnapshot,
  resolvePiutangTanggal,
  type PiutangPelangganPeriode,
} from "@/lib/piutang-pelanggan-server";
import {
  buildPiutangPdf,
  buildXlsx,
  piutangNamaFile,
  snapshotKeSheetPP,
} from "@/lib/piutang-pelanggan-export";

// GET /api/keuangan/laporan/piutang-pelanggan?periode=hari-ini&tanggal=&format=json|pdf|xlsx
// Laporan posisi per tanggal: satu sumber data untuk web, PDF, dan XLSX.
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "hari-ini";
    if (!(PIUTANG_PELANGGAN_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as PiutangPelangganPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const tanggal = searchParams.get("tanggal") || undefined;

    const { asOf, label } = resolvePiutangTanggal(periode, tanggal);
    const snapshot = await getPiutangPelangganSnapshot(asOf, label);

    if (format === "json") return successResponse(snapshot);

    if (format === "pdf") {
      const buf = buildPiutangPdf([snapshot]);
      const name = piutangNamaFile("pdf", snapshot.tanggal);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheetPP(snapshot, "Piutang Pelanggan")]);
    const name = piutangNamaFile("xlsx", snapshot.tanggal);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun Piutang Pelanggan", 400);
  }
}
