import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  PENJUALAN_PER_PRODUK_PERIODE,
  resolvePeriodeTanggal,
  getPenjualanPerProdukSnapshot,
  type PenjualanPerProdukPeriode,
} from "@/lib/penjualan-per-produk-server";
import {
  buildPenjualanPerProdukPdf,
  buildXlsx,
  penjualanPerProdukNamaFile,
  snapshotKeSheetPP,
} from "@/lib/penjualan-per-produk-export";

// GET /api/keuangan/laporan/penjualan-per-produk?periode=hari-ini&tanggalAwal=&tanggalAkhir=&format=json|pdf|xlsx
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "hari-ini";
    if (!(PENJUALAN_PER_PRODUK_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as PenjualanPerProdukPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const tanggalAwals = searchParams.get("tanggalAwal") ?? undefined;
    const tanggalAkhir = searchParams.get("tanggalAkhir") ?? undefined;

    const { dari, sampai, label } = resolvePeriodeTanggal(periode, tanggalAwals, tanggalAkhir);
    const snapshot = await getPenjualanPerProdukSnapshot(dari, sampai, label);

    if (format === "json") return successResponse(snapshot);

    if (format === "pdf") {
      const buf = buildPenjualanPerProdukPdf([snapshot]);
      const name = penjualanPerProdukNamaFile("pdf", dari.toISOString(), sampai.toISOString());
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheetPP(snapshot, "Penjualan per Produk")]);
    const name = penjualanPerProdukNamaFile("xlsx", dari.toISOString(), sampai.toISOString());
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun laporan Penjualan per Produk", 400);
  }
}
