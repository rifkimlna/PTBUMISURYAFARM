import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  BUKU_BESAR_PERIODE,
  getBukuBesarBulanan,
  getBukuBesarSnapshots,
  resolveBukuBesarRange,
  type BukuBesarPeriode,
} from "@/lib/buku-besar-server";
import {
  buildBukuBesarPdf,
  buildXlsx,
  bukuBesarNamaFile,
  snapshotKeSheet,
} from "@/lib/buku-besar-export";

// GET /api/keuangan/laporan/buku-besar?periode=bulan-ini[&dari=&sampai=][&akun=1101][&format=json|pdf|xlsx]
// Satu sumber data untuk halaman web, PDF, dan XLSX (jaminan angka konsisten).
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "bulan-ini";
    if (!(BUKU_BESAR_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as BukuBesarPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const dari = searchParams.get("dari") || undefined;
    const sampai = searchParams.get("sampai") || undefined;
    const akun = searchParams.get("akun") || undefined;

    const monthly = periode === "per-bulan-tahun-ini";
    const snapshots = monthly
      ? await getBukuBesarBulanan(akun)
      : await (async () => {
          const { start, end, label } = resolveBukuBesarRange(periode, dari, sampai);
          return await getBukuBesarSnapshots([{ start, end, label, periode }], akun);
        })();

    if (format === "json") {
      return successResponse(
        monthly ? { mode: "monthly", snapshots } : { mode: "single", snapshot: snapshots[0] }
      );
    }

    const akunSuffix = snapshots[0]?.akunFilter;
    if (format === "pdf") {
      const buf = buildBukuBesarPdf(snapshots);
      const name = monthly
        ? `Buku_Besar_PT_Bumi_Surya_Farm_${new Date().getFullYear()}_per-bulan.pdf`
        : bukuBesarNamaFile("pdf", snapshots[0].end, akunSuffix);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const sheets = snapshots.map((s) => snapshotKeSheet(s, monthly ? s.label : "Buku Besar"));
    const buf = buildXlsx(sheets);
    const name = monthly
      ? `Buku_Besar_PT_Bumi_Surya_Farm_${new Date().getFullYear()}_per-bulan.xlsx`
      : bukuBesarNamaFile("xlsx", snapshots[0].end, akunSuffix);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun Buku Besar", 400);
  }
}
