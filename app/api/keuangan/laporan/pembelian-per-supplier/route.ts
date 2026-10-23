import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  PEMBELIAN_PER_SUPPLIER_PERIODE,
  getPembelianPerSupplierSnapshot,
  resolvePembelianPerSupplierRange,
  type PembelianPerSupplierPeriode,
} from "@/lib/pembelian-per-supplier-server";
import {
  buildPembelianPerSupplierPdf,
  buildXlsx,
  pembelianPerSupplierNamaFile,
  snapshotKeSheetPS,
} from "@/lib/pembelian-per-supplier-export";

// GET /api/keuangan/laporan/pembelian-per-supplier?periode=hari-ini&dari=&sampai=&format=json|pdf|xlsx
// Satu sumber data untuk halaman web, PDF, dan XLSX (jaminan angka konsisten).
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "hari-ini";
    if (!(PEMBELIAN_PER_SUPPLIER_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as PembelianPerSupplierPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const dari = searchParams.get("dari") || undefined;
    const sampai = searchParams.get("sampai") || undefined;

    const { start, end, label } = resolvePembelianPerSupplierRange(periode, dari, sampai);
    const snapshot = await getPembelianPerSupplierSnapshot(start, end, label);

    if (format === "json") return successResponse(snapshot);

    if (format === "pdf") {
      const buf = buildPembelianPerSupplierPdf([snapshot]);
      const name = pembelianPerSupplierNamaFile("pdf", snapshot.end);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheetPS(snapshot, "Pembelian per Supplier")]);
    const name = pembelianPerSupplierNamaFile("xlsx", snapshot.end);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun Pembelian per Supplier", 400);
  }
}
