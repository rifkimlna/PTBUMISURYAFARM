import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  RINGKASAN_BISNIS_PERIODE,
  getRingkasanBisnisBulanan,
  getRingkasanBisnisSnapshot,
  resolveRingkasanRange,
  type RingkasanBisnisPeriode,
} from "@/lib/ringkasan-bisnis-server";
import {
  ringkasanBisnisNamaFile,
  buildRingkasanBisnisPdf,
  snapshotKeSheetRB,
} from "@/lib/ringkasan-bisnis-export";
import { buildXlsx } from "@/lib/dokumen-export";

// GET /api/keuangan/laporan/ringkasan-bisnis?periode=bulan-ini[&dari=&sampai=][&format=json|pdf|xlsx]
// Satu sumber data untuk halaman web, PDF, dan XLSX (jaminan angka konsisten).
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "bulan-ini";
    if (!(RINGKASAN_BISNIS_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as RingkasanBisnisPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const dari = searchParams.get("dari") || undefined;
    const sampai = searchParams.get("sampai") || undefined;

    const snapshots =
      periode === "per-bulan-tahun-ini"
        ? await getRingkasanBisnisBulanan()
        : await (async () => {
            const { start, end, label } = resolveRingkasanRange(periode, dari, sampai);
            return [await getRingkasanBisnisSnapshot(start, end, periode, label)];
          })();

    if (format === "json") {
      return successResponse(
        periode === "per-bulan-tahun-ini"
          ? { mode: "monthly", snapshots }
          : { mode: "single", snapshot: snapshots[0] }
      );
    }

    const monthly = periode === "per-bulan-tahun-ini";
    const year = new Date().getFullYear();
    if (format === "pdf") {
      const buf = buildRingkasanBisnisPdf(snapshots);
      const name = monthly
        ? `Ringkasan_Bisnis_PT_Bumi_Surya_Farm_${year}_per-bulan.pdf`
        : ringkasanBisnisNamaFile("pdf", snapshots[0].end);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const sheets = snapshots.map((s) =>
      snapshotKeSheetRB(s, monthly ? s.label : "Ringkasan Bisnis")
    );
    const buf = buildXlsx(sheets);
    const name = monthly
      ? `Ringkasan_Bisnis_PT_Bumi_Surya_Farm_${year}_per-bulan.xlsx`
      : ringkasanBisnisNamaFile("xlsx", snapshots[0].end);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun Ringkasan Bisnis", 400);
  }
}
