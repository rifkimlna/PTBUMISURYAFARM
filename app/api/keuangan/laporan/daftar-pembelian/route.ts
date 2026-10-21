import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  DAFTAR_PEMBELIAN_PERIODE,
  getDaftarPembelianSnapshot,
  resolveDaftarPembelianRange,
  type DaftarPembelianPeriode,
} from "@/lib/daftar-pembelian-server";
import {
  buildDaftarPembelianPdf,
  buildXlsx,
  daftarPembelianNamaFile,
  snapshotKeSheetDPB,
} from "@/lib/daftar-pembelian-export";

// GET /api/keuangan/laporan/daftar-pembelian?periode=&dari=&sampai=&supplier=&status=&tipe=&page=&limit=&format=json|pdf|xlsx
// Satu sumber data untuk halaman web, PDF, dan XLSX (jaminan angka konsisten).
// PDF/XLSX selalu memuat SELURUH baris terfilter (tanpa paginasi).
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "custom";
    if (!(DAFTAR_PEMBELIAN_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as DaftarPembelianPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const dari = searchParams.get("dari") || undefined;
    const sampai = searchParams.get("sampai") || undefined;
    const supplier = searchParams.get("supplier") || "";
    const status = searchParams.get("status") || "";
    const tipe = searchParams.get("tipe") || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 10));

    const { start, end, label } = resolveDaftarPembelianRange(periode, dari, sampai);

    if (format === "json") {
      const snapshot = await getDaftarPembelianSnapshot(start, end, label, {
        page,
        limit,
        paginate: true,
        supplier,
        status,
        tipe,
      });
      return successResponse({
        ...snapshot,
        pagination: {
          page,
          limit,
          total: snapshot.total,
          totalPages: Math.max(1, Math.ceil(snapshot.total / limit)),
        },
      });
    }

    const full = await getDaftarPembelianSnapshot(start, end, label, {
      paginate: false,
      supplier,
      status,
      tipe,
    });
    if (format === "pdf") {
      const buf = buildDaftarPembelianPdf([full]);
      const name = daftarPembelianNamaFile("pdf", full.end);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheetDPB(full, "Daftar Pembelian")]);
    const name = daftarPembelianNamaFile("xlsx", full.end);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun Daftar Pembelian", 400);
  }
}
