import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  getProfitabilitasSnapshot,
  resolveProfitRentang,
} from "@/lib/profitabilitas-produk-server";
import { labelRentang } from "@/lib/profitabilitas-produk-types";
import {
  buildProfitabilitasPdf,
  buildXlsx,
  profitabilitasNamaFile,
  snapshotKeSheetProfit,
} from "@/lib/profitabilitas-produk-export";

// GET /api/keuangan/laporan/profitabilitas-produk?dari=&sampai=&produk=&kategori=&page=&limit=&format=json|pdf|xlsx
// Satu sumber data untuk halaman web, PDF, dan XLSX (jaminan angka konsisten).
// PDF/XLSX selalu memuat SELURUH baris terfilter (tanpa paginasi).
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const dari = searchParams.get("dari") || undefined;
    const sampai = searchParams.get("sampai") || undefined;
    const produk = searchParams.get("produk") || undefined;
    const kategori = searchParams.get("kategori") || undefined;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 25));

    const { start, end } = resolveProfitRentang(dari, sampai);
    const ymdLokal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const label = labelRentang(ymdLokal(start), ymdLokal(end));
    const filter = { produk, kategori };

    if (format === "json") {
      const snapshot = await getProfitabilitasSnapshot(start, end, label, {
        page,
        limit,
        paginate: true,
        ...filter,
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

    const full = await getProfitabilitasSnapshot(start, end, label, {
      paginate: false,
      ...filter,
    });
    if (format === "pdf") {
      const buf = buildProfitabilitasPdf([full]);
      const name = profitabilitasNamaFile("pdf", full.sampai);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheetProfit(full, "Profitabilitas Produk")]);
    const name = profitabilitasNamaFile("xlsx", full.sampai);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun Profitabilitas Produk", 400);
  }
}
