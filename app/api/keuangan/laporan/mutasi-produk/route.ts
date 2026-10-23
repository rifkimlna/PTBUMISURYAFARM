import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  MUTASI_PRODUK_PERIODE,
  resolvePeriodeTanggal,
  getMutasiProdukSnapshot,
  type MutasiProdukPeriode,
} from "@/lib/mutasi-produk-server";
import {
  buildMutasiProdukPdf,
  buildXlsx,
  mutasiProdukNamaFile,
  snapshotKeSheetMutasi,
} from "@/lib/mutasi-produk-export";

// GET /api/keuangan/laporan/mutasi-produk?periode=bulan-ini&tanggalAwal=&tanggalAkhir=&format=json|pdf|xlsx
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "bulan-ini";
    if (!(MUTASI_PRODUK_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as MutasiProdukPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const tanggalAwals = searchParams.get("tanggalAwal") ?? undefined;
    const tanggalAkhir = searchParams.get("tanggalAkhir") ?? undefined;

    const { dari, sampai, label } = resolvePeriodeTanggal(periode, tanggalAwals, tanggalAkhir);
    const snapshot = await getMutasiProdukSnapshot(dari, sampai, label);

    if (format === "json") return successResponse(snapshot);

    if (format === "pdf") {
      const buf = buildMutasiProdukPdf([snapshot]);
      const name = mutasiProdukNamaFile("pdf", dari.toISOString(), sampai.toISOString());
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheetMutasi(snapshot, "Mutasi Produk")]);
    const name = mutasiProdukNamaFile("xlsx", dari.toISOString(), sampai.toISOString());
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun laporan Mutasi Produk", 400);
  }
}
