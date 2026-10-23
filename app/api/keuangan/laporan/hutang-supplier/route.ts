import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  HUTANG_SUPPLIER_PERIODE,
  getHutangSupplierSnapshot,
  resolveHutangTanggal,
  type HutangSupplierPeriode,
} from "@/lib/hutang-supplier-server";
import {
  buildHutangPdf,
  buildHutangXlsx,
  hutangNamaFile,
  snapshotKeSheetHS,
} from "@/lib/hutang-supplier-export";

// GET /api/keuangan/laporan/hutang-supplier?periode=hari-ini&tanggal=&dari=&page=&limit=&format=json|pdf|xlsx
// Laporan posisi per tanggal: satu sumber data untuk web, PDF, dan XLSX.
// `dari` (opsional) = tanggal awal periode untuk baris saldo awal + mutasi.
// PDF/XLSX selalu memuat SELURUH grup terfilter (tanpa paginasi).
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "hari-ini";
    if (!(HUTANG_SUPPLIER_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as HutangSupplierPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const tanggal = searchParams.get("tanggal") || undefined;
    const dariRaw = searchParams.get("dari") || undefined;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 10));

    const { asOf, label } = resolveHutangTanggal(periode, tanggal);
    let from: Date | undefined;
    if (dariRaw) {
      const d = new Date(dariRaw);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        from = d;
      }
    }

    if (format === "json") {
      const snapshot = await getHutangSupplierSnapshot(asOf, label, { page, limit, paginate: true, from });
      return successResponse({
        ...snapshot,
        pagination: {
          page,
          limit,
          total: snapshot.totalGrup,
          totalPages: Math.max(1, Math.ceil(snapshot.totalGrup / limit)),
        },
      });
    }

    const full = await getHutangSupplierSnapshot(asOf, label, { paginate: false, from });
    if (format === "pdf") {
      const buf = buildHutangPdf([full]);
      const name = hutangNamaFile("pdf", full.tanggal);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildHutangXlsx([snapshotKeSheetHS(full, "Hutang Supplier")]);
    const name = hutangNamaFile("xlsx", full.tanggal);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun Hutang Supplier", 400);
  }
}
