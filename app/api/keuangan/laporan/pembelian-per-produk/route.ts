import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  PEMBELIAN_PER_PRODUK_PERIODE,
  getPembelianPerProdukSnapshot,
  resolvePembelianPerProdukTanggal,
  type PembelianPerProdukPeriode,
} from "@/lib/pembelian-per-produk-server";
import {
  buildPembelianPerProdukPdf,
  buildPembelianXlsx,
  pembelianPerProdukNamaFile,
  snapshotKeSheetPPB,
} from "@/lib/pembelian-per-produk-export";

// GET /api/keuangan/laporan/pembelian-per-produk?periode=hari-ini&dari=&sampai=&format=json|pdf|xlsx
// Satu sumber data untuk halaman web, PDF, dan XLSX (jaminan angka konsisten).
// Rekap per produk dari Faktur Pembelian (pembelian) dan Tukar Faktur (retur).
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "hari-ini";
    if (!(PEMBELIAN_PER_PRODUK_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as PembelianPerProdukPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const dari = searchParams.get("dari") || undefined;
    const sampai = searchParams.get("sampai") || undefined;

    const { start, end, label } = resolvePembelianPerProdukTanggal(periode, dari, sampai);
    const snapshot = await getPembelianPerProdukSnapshot(start, end, label);

    if (format === "json") return successResponse(snapshot);

    if (format === "pdf") {
      const buf = buildPembelianPerProdukPdf([snapshot]);
      const name = pembelianPerProdukNamaFile("pdf", snapshot.end);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildPembelianXlsx([snapshotKeSheetPPB(snapshot, "Pembelian per Produk")]);
    const name = pembelianPerProdukNamaFile("xlsx", snapshot.end);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun laporan Pembelian per Produk", 400);
  }
}
