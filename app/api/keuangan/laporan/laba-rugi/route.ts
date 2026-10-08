import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  LABA_RUGI_PERIODE,
  getLabaRugiBulanan,
  getLabaRugiSnapshot,
  resolveLabaRugiRange,
  type LabaRugiPeriode,
} from "@/lib/laba-rugi-server";
import {
  buildLabaRugiPdf,
  labaRugiNamaFile,
  snapshotKeSheetLR,
} from "@/lib/laba-rugi-export";
import { buildXlsx } from "@/lib/dokumen-export";

// GET /api/keuangan/laporan/laba-rugi?periode=bulan-ini[&dari=&sampai=][&format=json|pdf|xlsx]
// Satu sumber data untuk halaman web, PDF, dan XLSX (jaminan angka konsisten).
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "bulan-ini";
    if (!(LABA_RUGI_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as LabaRugiPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const dari = searchParams.get("dari") || undefined;
    const sampai = searchParams.get("sampai") || undefined;

    const snapshots =
      periode === "per-bulan-tahun-ini"
        ? await getLabaRugiBulanan()
        : await (async () => {
            const { start, end, label } = resolveLabaRugiRange(periode, dari, sampai);
            return [await getLabaRugiSnapshot(start, end, periode, label)];
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
      const buf = buildLabaRugiPdf(snapshots);
      const name = monthly
        ? `Laba_Rugi_PT_Bumi_Surya_Farm_${year}_per-bulan.pdf`
        : labaRugiNamaFile("pdf", snapshots[0].end);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const sheets = snapshots.map((s) =>
      snapshotKeSheetLR(s, monthly ? s.label : "Laba Rugi")
    );
    const buf = buildXlsx(sheets);
    const name = monthly
      ? `Laba_Rugi_PT_Bumi_Surya_Farm_${year}_per-bulan.xlsx`
      : labaRugiNamaFile("xlsx", snapshots[0].end);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun Laba Rugi", 400);
  }
}
