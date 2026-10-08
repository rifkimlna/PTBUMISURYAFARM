import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  NERACA_PERIODE,
  getNeracaBulanan,
  getNeracaSnapshot,
  resolveNeracaRange,
  type NeracaPeriode,
} from "@/lib/neraca-server";
import {
  buildNeracaPdf,
  buildXlsx,
  neracaNamaFile,
  snapshotKeSheet,
} from "@/lib/neraca-export";

// GET /api/keuangan/laporan/neraca?periode=bulan-ini[&dari=&sampai=][&format=json|pdf|xlsx]
// Satu sumber data untuk halaman web, PDF, dan XLSX (jaminan angka konsisten).
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "bulan-ini";
    if (!(NERACA_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as NeracaPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const dari = searchParams.get("dari") || undefined;
    const sampai = searchParams.get("sampai") || undefined;

    const snapshots =
      periode === "per-bulan-tahun-ini"
        ? await getNeracaBulanan()
        : await (async () => {
            const { start, end, label } = resolveNeracaRange(periode, dari, sampai);
            return [await getNeracaSnapshot(end, periode, label, start)];
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
      const buf = buildNeracaPdf(snapshots);
      const name = monthly
        ? `Neraca_PT_Bumi_Surya_Farm_${year}_per-bulan.pdf`
        : neracaNamaFile("pdf", snapshots[0].end);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const sheets = snapshots.map((s) =>
      snapshotKeSheet(s, monthly ? s.label : "Neraca")
    );
    const buf = buildXlsx(sheets);
    const name = monthly
      ? `Neraca_PT_Bumi_Surya_Farm_${year}_per-bulan.xlsx`
      : neracaNamaFile("xlsx", snapshots[0].end);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun Neraca", 400);
  }
}
